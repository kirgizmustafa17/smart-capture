# SmartCapture PRO 📸

> DOM öğe tespiti, serbest kement kırpma, tam sayfa birleştirme ve entegre Vektörel Tuval Düzenleme Stüdyosu içeren, gizlilik odaklı güçlü Chrome ve Chromium ekran görüntüsü alma eklentisi.

[Türkçe](README.tr.md) | [English](README.md)

---

## 🌟 Öne Çıkan Özellikler

### 🎯 5 Esnek Ekran Yakalama Modu
1. **Öğe / DOM Blok Seçici**: Herhangi bir HTML öğesinin, grafiğin, başlığın veya kartın üzerine gelin; sınırlarını otomatik algılayarak tek tıkla yakalayın.
2. **Dikdörtgen Seçim Alanı**: Canlı piksel ölçüleri ve kılavuz koordinatlarla özel dikdörtgen bir alan belirleyin.
3. **Serbest Kement (Lasso)**: Organik kırpmalar için fareyle serbest kontur veya çokgen çizerek yakalayın.
4. **Görünür Ekran**: Mevcut sekmenin görünür kısmını cihazın tam piksel çözünürlüğünde anında yakalayın.
5. **Tam Sayfa Birleştirme**: Uzun dokümanlar ve sonsuz kaydırma sayfaları için otomatik kaydırma ve dikişsiz piksel birleştirme.

### 🎨 Entegre Düzenleyici Stüdyo (Editor Studio)
- **Vektörel Çizim & İşaretleme**: Serbest çizim kalemi, yön okları, geometrik şekiller (dikdörtgen, daire/elips), fosforlu vurgulayıcı, metin etiketleri ve numaralandırılmış adım işaretleri (1, 2, 3...).
- **Seç & Taşı, Boyutlandır ve Sil (V)**:
  - Çizilen tüm öğeleri tek tıkla seçme (kesikli cyan çerçeve ve köşe tutamaçları).
  - Canlı sürükleyip taşıma (drag & drop).
  - Köşe noktalarından boyutlandırma (resize).
  - Seçim sonrası canlı renk ve çizgi kalınlığı (2px / 4px / 8px) değişimi.
  - `Delete` / `Backspace` tuşu veya araç çubuğundaki silme butonuyla anında kaldırma.
- **Renk Seçici Damlalık (I)**:
  - Tuval üzerindeki herhangi bir pikselden canlı büyüteç (loupe) HUD ile hassas renk örnekleme.
  - Seçilen rengin HEX kodunu otomatik kopyalama ve dinamik palet rozetine ekleme.
- **Gizlilik & Sansürleme Araçları**:
  - **Pikselli Mozaik**: Hassas kimlik bilgileri, e-postalar ve hesap numaralarını sansürleyin.
  - **Yumuşak Blur**: Arka planı veya gizli alanları estetik bir biçimde yumuşatın.
- **Geçmiş & Performans**: `Ctrl+Z` (Geri Al) ve `Ctrl+Y` (Yinele) geçmiş yığını, `willReadFrequently` ile optimize edilmiş 2D tuval işleme motoru.

### ⚡ Hızlı İş Akışı, Sağ Dışa Aktarma Paneli (Dock) ve Formatlar
- **Sağ Dışa Aktarma Kenar Çubuğu (Export Dock)**:
  - Görsel formatı hapları (`PNG`, `JPG`, `WebP`) ile anında format değiştirme.
  - Büyük, dokunsal **Panoya Kopyala** (`Ctrl+C`) ve **Resmi İndir** (`Ctrl+S`) butonları.
  - Canlı görsel çözünürlüğü, en-boy oranı (aspect ratio) ve aktif renk özeti kartı.
  - Açılıp kapanabilir (toggle/collapse) esnek dock düzeni.
- **Klavye Kısayolları**: V (Seç), P (Kalem), A (Ok), R (Kutu), O (Daire), H (Vurgu), M (Mozaik), B (Blur), T (Metin), N (Adım), C (Kırp), I (Damlalık).
- **Yerel Çoklu Dil (i18n)**: Türkçe ve İngilizce tam dil desteği.

---

## 🚀 Kurulum (Geliştirici Modu)

1. Bu depoyu klonlayın veya indirin:
   ```bash
   git clone https://github.com/kirgizmustafa17/smart-capture.git
   ```
2. Chrome (veya Brave, Edge, Opera gibi Chromium tabanlı herhangi bir tarayıcı) açın ve adres çubuğuna şunu yazın:
   ```text
   chrome://extensions
   ```
3. Sağ üst köşedeki **Geliştirici modu** (*Developer mode*) anahtarını açın.
4. **Paketlenmemiş öğe yükle** (*Load unpacked*) butonuna tıklayın.
5. İndirdiğiniz `smart-capture` klasörünü seçin.
6. SmartCapture PRO simgesi tarayıcınızın uzantılar menüsünde görünecektir!

---

## 📁 Mimari ve Proje Yapısı

```text
smart-capture/
├── manifest.json            # Chrome Manifest V3 konfigürasyonu
├── _locales/                # Çoklu dil dizeleri (en, tr)
│   ├── en/messages.json
│   └── tr/messages.json
├── background/              # Arka plan servis çalışanı (yakalama koordinasyonu)
│   └── background.js
├── content/                 # Web sayfalarına enjekte edilen içerik betikleri
│   ├── area-select.js       # Dikdörtgen alan seçici
│   ├── freehand-select.js   # Serbest kement seçici
│   ├── inspector.js         # DOM öğesi gezinme ve kilitlenme müfettişi
│   ├── full-page.js         # Kaydırarak tam sayfa birleştirici
│   ├── editor.js            # Sayfa içi katman yardımcıları
│   ├── content.js           # İçerik koordinatörü
│   └── content.css          # Enjekte edilen stiller
├── editor/                  # Tam ekran Düzenleyici Stüdyosu (ayrı sekme)
│   ├── editor.html          # Stüdyo arayüzü
│   ├── editor.js            # UI denetleyicisi ve kısayol yöneticisi
│   ├── editor.css           # Obsidian Precision tasarım sistemi teması
│   └── canvas-engine.js     # Vektörel katman, filtre, çizim ve seçim motoru
├── popup/                   # Tarayıcı eylemi eklenti açılır penceresi (Popup UI)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/                     # Ortak yardımcı işlevler
│   └── utils.js
├── icons/                   # Eklenti simgeleri (16, 48, 128px)
├── GEMINI.md                # Proje kuralları ve SemVer politikası
└── generate_icons.js        # Uygulama simgelerini üreten tuval betiği
```

---

## 🔒 İzinler ve Gizlilik Güvencesi

- **Gerekli İzinler**: `activeTab`, `scripting`, `downloads`, `storage`, `contextMenus`.
- **Sıfır Harici İzleme**: Tüm görsel işleme, tuval çizimleri, bulanıklaştırma ve sayfa birleştirme işlemleri **%100 yerel olarak cihazınızda** gerçekleşir. Yakalanan hiçbir veri veya gezinme geçmişi asla üçüncü taraf bir sunucuya gönderilmez.

---

## 📌 Sürüm Politikası (Semantic Versioning)

Bu proje [Semantic Versioning (SemVer 2.0.0)](https://semver.org/) standardını benimser.
- **MAJOR (X.0.0)**: Geriye dönük uyumsuz mimari değişiklikler veya izin güncellemeleri.
- **MINOR (x.Y.0)**: Geriye dönük uyumlu yeni özellikler, araçlar ve dışa aktarma seçenekleri.
- **PATCH (x.y.Z)**: Geriye dönük uyumlu hata düzeltmeleri, CSS/UI iyileştirmeleri ve performans artırımları.

Birincil sürüm kaynağı `manifest.json` dosyasıdır.

---

## 📄 Lisans

MIT Lisansı © 2026 Mustafa Kırgız

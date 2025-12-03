# 🌐 Web Panelli Gelişmiş Discord Botu

Bu proje, Discord sunucularınızı kolayca yönetmenizi sağlayan, modüler bir yapıya sahip ve web tabanlı bir kontrol paneli içeren gelişmiş bir Discord botudur.

## ✨ Özellikler

- **Web Kontrol Paneli:** Botu ve sunucu ayarlarını tarayıcınız üzerinden yönetin.
- **Modüler Yapı:** İhtiyacınıza göre özellikleri (modülleri) kolayca etkinleştirin veya devre dışı bırakın.
- **Rol Yönetimi:** Web paneli üzerinden rol oluşturun, düzenleyin, silin ve üyelere rol atayın.
- **Kanal Yönetimi:** Kanalları ve kategorileri görüntüleyin.
- **Sunucu İstatistikleri:** Üye, kanal, rol sayıları ve çevrimiçi durumlar gibi detaylı istatistikler.
- **Denetim Kaydı:** Sunucudaki son olayları panelden takip edin.
- **Gelişmiş Uyarı Sistemi:** `/uyar`, `/uyarılar` ve `/uyarı-sil` komutları ile moderasyonu kolaylaştırır. Web panelinden ayarlanabilen otomatik ceza (susturma, atma, yasaklama) kuralları sunar.
- **Yasaklama Yönetimi:** Gelişmiş `/ban` ve `/unban` komutları. Web panelinden yasaklı kullanıcıları görüntüleme ve yasaklarını kaldırma.
- **Süper Kilitli Kanallar:** `/lockdown` komutu ile yöneticilerin bile özel izin olmadan giremeyeceği, tamamen izole edilmiş metin ve ses kanalları oluşturma.
- **Seviye Sistemi:** Sunucu içi etkileşimi artırmak için XP ve seviye sistemi.
- **Geçici Ses Kanalları:** Kullanıcıların, belirlenen bir kanala girerek kendilerine özel, geçici ses odaları oluşturmasını sağlar.
- **Ekonomi Sistemi:** Sunucu içi etkileşimi artırmak için `/gunluk`, `/calis` gibi komutlarla para kazanma, marketten rol satın alma ve `/para-gonder` gibi özellikler içerir.
- **Tepki Rol (Reaction Roles):** Kullanıcıların bir mesaja tepki vererek rol almasını sağlayın.
- **Anti-Raid:** Sunucunuzu spam ve raid saldırılarına karşı koruyun.
- **Yedekleme ve Geri Yükleme:** Sunucu rollerini, kanallarını ve ayarlarını tek tıkla yedekleyin ve geri yükleyin.
- **Kayıt Sistemi:** `/kayit` komutu ile üyeleri sunucuya kaydedin, istatistikleri takip edin ve özel hoş geldin mesajları gönderin.
- **Bilet Sistemi:** Kullanıcıların destek talepleri oluşturması için gelişmiş bir panel ve özel kanallar oluşturun.
- **Davet Takipçisi:** Sunucuya kimin kimi davet ettiğini takip edin ve davet sayısına göre otomatik roller verin.
- **Karşılama & Uğurlama:** Sunucuya yeni katılan veya ayrılan üyelere resimli ve özelleştirilebilir mesajlar gönderin.
- **Duyuru Sistemi:** Web panelden aktif edilen ve Discord'dan yönetilen gelişmiş bir duyuru paneli.
- **Otomatik Rol:** Sunucuya yeni katılan üyelere otomatik olarak bir rol atayın.
- **Link Engelleyici:** Sunucunuzda Discord davetlerini ve diğer harici linkleri engelleyin.

---

## ⚙️ Kurulum ve Yapılandırma

Projeyi çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler
- Node.js v18.x veya daha üstü.

### 1. Adım: Projeyi İndirin ve Bağımlılıkları Yükleyin

Proje dosyalarını indirdikten sonra, terminal veya komut istemcisini proje klasöründe açın ve aşağıdaki komutu çalıştırarak gerekli tüm paketleri yükleyin:

```bash
npm install
```

### 2. Adım: Discord Bot Uygulaması Oluşturma

Botun çalışması için Discord'dan bazı bilgilere ihtiyacınız olacak.

1.  **[Discord Developer Portal](https://discord.com/developers/applications)** adresine gidin ve giriş yapın.
2.  Sağ üstteki **"New Application"** butonuna tıklayın ve botunuza bir isim verin.
3.  Oluşturduğunuz uygulamanın sayfasında, sol menüden **"Bot"** sekmesine gidin.
4.  **"Add Bot"** butonuna tıklayarak bir bot kullanıcısı oluşturun.
5.  **"Reset Token"** butonuna tıklayarak botunuzun token'ını alın ve bir yere kaydedin. **Bu token'ı kimseyle paylaşmayın!**
6.  Aynı sayfada, aşağı kaydırarak **"Privileged Gateway Intents"** bölümünü bulun ve aşağıdaki üç intent'i de **AKTİF** hale getirin:
    - `PRESENCE INTENT`
    - `SERVER MEMBERS INTENT`
    - `MESSAGE CONTENT INTENT`
7.  Sol menüden **"OAuth2"** sekmesine gidin.
    - **"General"** alt sekmesinde, **CLIENT ID** ve **CLIENT SECRET** değerlerini kopyalayıp kaydedin. Client Secret'ı görmek için "Reset Secret" butonuna basmanız gerekebilir.
    - **"Redirects"** bölümüne gelin ve **"Add Redirect"** butonuna tıklayın. Aşağıdaki URL'yi ekleyin:
      ```
      http://localhost:3000/auth/callback
      ```
      Eğer farklı bir alan adı veya port kullanacaksanız, `localhost:3000` kısmını ona göre güncelleyin.

### 3. Adım: Ortam Değişkenlerini Ayarlama

Projenin ana dizininde `.env` adında yeni bir dosya oluşturun. Bu dosyanın içine, bir önceki adımda aldığınız bilgileri aşağıdaki gibi girin:

```env
# Discord Bot Ayarları
BOT_TOKEN=BURAYA_BOT_TOKENINIZI_YAPISTIRIN
CLIENT_ID=BURAYA_CLIENT_ID_YAPISTIRIN
CLIENT_SECRET=BURAYA_CLIENT_SECRET_YAPISTIRIN

# Web Panel Ayarları
# Eğer botu kendi bilgisayarınızda çalıştırıyorsanız bu ayarı değiştirmeyin.
# Eğer bir sunucuya (VDS/VPS) yüklerseniz, sunucunuzun IP adresini veya alan adını yazın.
# Örnek: http://123.45.67.89:3000 veya https://botpanelim.com
APP_URL=http://localhost:3000

# Lisans Kontrolü Ayarları (Geliştirici Tarafından Sağlanır)
LICENSE_KEY=BURAYA_SIZE_VERİLEN_LİSANS_ANAHTARINI_YAPISTIRIN
LICENSE_API_ENDPOINT=GELİŞTİRİCİNİN_LİSANS_DOGRULAMA_API_ADRESİ

# Port numarasını değiştirmek isterseniz bu satırı kullanabilirsiniz (isteğe bağlı).
# PORT=3000
```

### 4. Adım: Botu Sunucunuza Ekleme

1.  **Discord Developer Portal**'da, uygulamanızın **"OAuth2"** menüsü altındaki **"URL Generator"** sayfasına gidin.
2.  **"SCOPES"** bölümünden `bot` ve `applications.commands` seçeneklerini işaretleyin.
3.  Aşağıda açılan **"BOT PERMISSIONS"** bölümünden bota vermek istediğiniz izinleri seçin. En sorunsuz deneyim için **"Administrator" (Yönetici)** iznini vermeniz tavsiye edilir.
4.  Sayfanın en altında oluşan davet linkini kopyalayın, tarayıcınızda açın ve botu istediğiniz sunucuya ekleyin.

---

## 🚀 Botu Başlatma

Tüm yapılandırmaları tamamladıktan sonra, projenin ana dizininde terminali açın ve aşağıdaki komutla botu başlatın:

```bash
npm start
```

Eğer her şey yolunda gittiyse, terminalde botun ve web panelinin başarıyla başlatıldığına dair mesajlar göreceksiniz. Artık tarayıcınızdan `http://localhost:3000` adresine giderek web paneline erişebilirsiniz.

---

## ❓ Destek

Kurulum veya kullanım sırasında bir sorunla karşılaşırsanız, lütfen benimle iletişime geçin.

# 🚀 Web Panelli Discord Botu Kurulum Rehberi

Bu rehber, satın almış olduğunuz Discord botunu **tek bir komutla** kolayca nasıl kuracağınızı anlatmaktadır.

---

## ⚙️ Adım 1: Gereksinimler

Botu çalıştırmak için sunucunuzda **Node.js v18 veya daha üstü** bir sürümün yüklü olması gerekmektedir.

---

## 🤖 Adım 2: Discord Bot Bilgilerini Hazırlama

Kurulum sihirbazı sizden bazı bilgiler isteyecektir. Lütfen bu bilgileri önceden hazırlayın:

---

1.  **Discord Bot Bilgileri:**
    - **Discord Developer Portal** adresine gidin.
    - Botunuzun uygulamasına tıklayın.
    - **"Bot"** sekmesinden **Bot Token**'ınızı alın (`Reset Token` gerekebilir).
    - **"OAuth2" -> "General"** sekmesinden **Client ID** ve **Client Secret** değerlerinizi alın.
    - **"Privileged Gateway Intents"** bölümündeki `PRESENCE`, `SERVER MEMBERS` ve `MESSAGE CONTENT` intent'lerinin **aktif** olduğundan emin olun.

2.  **Web Panel URL'si:**
    - Botun web paneline hangi adresten erişeceğinizi belirleyin. (Örn: `http://SUNUCU_IP_ADRESINIZ:3000`)
    - Belirlediğiniz bu URL'nin sonuna `/auth/callback` ekleyerek **"OAuth2" -> "Redirects"** bölümüne ekleyin. (Örn: `http://SUNUCU_IP_ADRESINIZ:3000/auth/callback`)

3.  **Lisans Anahtarı:**
    - Geliştirici tarafından size sağlanan lisans anahtarını hazır bulundurun.

---

## 🚀 Adım 3: Kurulumu Başlatma

1.  Size gönderilen `.zip` dosyasını sunucunuza yükleyin ve dosyaları bir klasöre çıkartın.
2.  Terminali açın ve dosyaları çıkarttığınız klasörün içine girin.
3.  Kurulumu başlatmak için aşağıdaki komutu çalıştırın:
    ```bash
    npm run setup
    ```
4.  Kurulum sihirbazı sizden hazırladığınız bilgileri isteyecektir. Bilgileri girdikten sonra kurulum otomatik olarak tamamlanacaktır.

---

## 🎵 Adım 4: Müzik Botu İçin YouTube Çerezlerini Ayarlama (ÖNEMLİ)

Müzik botunun stabil çalışması ve şarkıları hatasız bulabilmesi için bu adım **zorunludur**.

1.  Bilgisayarınızda Chrome veya Firefox tarayıcısını açın.
2.  **YouTube.com**'a gidin ve bir Google hesabına giriş yapın.
3.  Tarayıcınıza **"Get cookies.txt LOCALLY"** adlı eklentiyi kurun.
    *   [Chrome için Eklenti Linki](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cbojebbeobfhnofknioajgaonaoedmmg)
    *   [Firefox için Eklenti Linki](https://addons.mozilla.org/tr/firefox/addon/get-cookies-txt-locally/)
4.  Eklentiyi kurduktan sonra, YouTube sekmesi açıkken tarayıcınızın sağ üst köşesindeki eklenti ikonuna tıklayın.
5.  Açılan küçük pencerede, ortadaki **"Export"** butonuna tıklayarak `cookies.txt` dosyasını indirin.
6.  İndirdiğiniz `cookies.txt` dosyasını, bot projenizin içindeki **`db` klasörünün içine** taşıyın.
7.  Son olarak, `.env` dosyanızı açın ve en altına aşağıdaki satırı ekleyin:

    ```env
    YOUTUBE_COOKIE_PATH=./db/cookies.txt
    ```

---

## 🏁 Adım 4: Botu Çalıştırma

Kurulum tamamlandıktan sonra botu kalıcı olarak çalıştırmak için **PM2** kullanmanız önerilir.

```bash
# PM2'yi yükleyin (eğer yüklü değilse): npm install pm2 -g
pm2 start bot.js --name "discord-bot"
```

Eğer her şey yolunda gittiyse, terminalde botun ve web panelinin başarıyla başlatıldığına dair mesajlar göreceksiniz. Artık tarayıcınızdan `http://localhost:3000` (veya `APP_URL`'de ne belirttiyseniz o adres) adresine giderek web paneline erişebilirsiniz.

---

## ❓ Destek

Kurulum veya kullanım sırasında bir sorunla karşılaşırsanız, lütfen botu satın aldığınız geliştirici ile iletişime geçin.
// c:\Users\emirc\OneDrive\Desktop\web-panelli-lisans\web-panelli-discord-bot\setup.js

const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("======================================================");
console.log("🚀 Web Panelli Discord Bot Kurulum Sihirbazına Hoş Geldiniz!");
console.log("======================================================");
console.log("Lütfen aşağıdaki bilgileri dikkatlice girin.\n");

const questions = [
    { key: 'BOT_TOKEN', prompt: '1. Discord Bot Token\'ınız: ' },
    { key: 'CLIENT_ID', prompt: '2. Discord Bot Client ID\'niz: ' },
    { key: 'CLIENT_SECRET', prompt: '3. Discord Bot Client Secret\'ınız: ' },
    { key: 'APP_URL', prompt: '4. Web Panel URL\'niz (Örn: http://SUNUCU_IP:3000): ' },
    { key: 'LICENSE_KEY', prompt: '5. Size verilen Lisans Anahtarınız: ' }
];

const answers = {};

function askQuestion(index) {
    if (index >= questions.length) {
        createEnvFile();
        return;
    }

    const { key, prompt } = questions[index];
    rl.question(prompt, (answer) => {
        if (!answer.trim()) {
            console.log("\n❌ Bu alan boş bırakılamaz. Lütfen tekrar deneyin.\n");
            askQuestion(index);
        } else {
            answers[key] = answer.trim();
            askQuestion(index + 1);
        }
    });
}

function createEnvFile() {
    rl.close();
    console.log("\n✅ Bilgiler alındı. .env dosyası oluşturuluyor...");

    const envContent = `
# Discord Bot Ayarları
BOT_TOKEN=${answers.BOT_TOKEN}
CLIENT_ID=${answers.CLIENT_ID}
CLIENT_SECRET=${answers.CLIENT_SECRET}

# Web Panel Ayarları
APP_URL=${answers.APP_URL}
PORT=3000

# Lisans Bilgileri
LICENSE_KEY=${answers.LICENSE_KEY}
LICENSE_API_ENDPOINT=http://91.232.103.101:8080/api/validate

# =================================================
#          İSTEĞE BAĞLI AYARLAR
# =================================================
# Güvenilir kullanıcılar (Bot sahibi gibi yetki vermek için, virgülle ayırın)
TRUSTED_USERS=

# Engellenen kullanıcılar (Panele erişimi engellemek için, virgülle ayırın)
BLOCKED_USERS=
`;

    fs.writeFileSync('.env', envContent.trim());
    console.log("✅ .env dosyası başarıyla oluşturuldu.");
    installDependencies();
}

function installDependencies() {
    console.log("\n⚙️  Gerekli paketler yükleniyor... Bu işlem biraz zaman alabilir.");

    const installProcess = exec('npm install --production', (error, stdout, stderr) => {
        if (error) {
            console.error(`\n❌ Paketler yüklenirken bir hata oluştu: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`\nUyarılar: ${stderr}`);
        }
        console.log(`\n${stdout}`);
        console.log("======================================================");
        console.log("✅ Temel kurulum başarıyla tamamlandı!");
        console.log("\n======================================================");
        console.log("❗ ÖNEMLİ SON ADIM: MÜZİK BOTU AKTİVASYONU ❗");
        console.log("======================================================");
        console.log("Müzik botunun hatasız çalışması için YouTube çerezlerinizi eklemeniz GEREKMEKTEDİR.");
        console.log("\nLütfen aşağıdaki adımları izleyin:");
        console.log("\n1. Tarayıcınıza 'Get cookies.txt LOCALLY' eklentisini kurun.");
        console.log("2. YouTube.com'a gidin ve 'Export' butonuna basarak 'cookies.txt' dosyasını indirin.");
        console.log("3. İndirdiğiniz 'cookies.txt' dosyasını, botun dosyalarının içindeki 'db' klasörüne atın.");
        console.log("4. '.env' dosyasını açın ve en altına şu satırı ekleyin:");
        console.log("   YOUTUBE_COOKIE_PATH=./db/cookies.txt");
        console.log("\nBu adımı tamamladıktan sonra botu başlatabilirsiniz.");
        console.log("------------------------------------------------------");
        console.log("\nBotu PM2 ile başlatmak için:");
        console.log("   pm2 start bot.js --name \"WebPanelliBot\"");
        console.log("\nNormal başlatmak için:");
        console.log("   npm start");
        console.log("======================================================");
    });

    installProcess.stdout.on('data', (data) => {
        process.stdout.write('.'); // Her ilerlemede bir nokta yazdır
    });
}

// Kurulumu başlat
askQuestion(0);

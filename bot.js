// ================== DEPENDENCIES ==================
const { WebhookClient } = require('discord.js'); // WebhookClient ekle
console.log("\n\n[DEBUG] bot.js dosyası çalıştırılıyor.\n\n");

// YENİ: .env dosyasını akıllıca yükle (dist klasörü uyumluluğu için)
const fsSync = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Önce mevcut dizine bak, yoksa bir üst dizine bak (dist içinde çalışıyorsa)
const envPath = fsSync.existsSync(path.join(__dirname, '.env')) 
    ? path.join(__dirname, '.env') 
    : path.join(__dirname, '..', '.env');

console.log(`[DEBUG] .env dosyası aranıyor: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
    console.warn(`[UYARI] .env dosyası yüklenemedi veya bulunamadı. Ortam değişkenleri sistemden bekleniyor.`);
}

// GÜNCELLEME KONTROLÜ İÇİN GEREKLİ MODÜLLER
// Bu modüller, ana bot mantığından önce çalışması gerektiği için dışarıya taşındı.
const fs = require('fs').promises;

const GITHUB_REPO_URL = 'https://api.github.com/repos/EmirCobanOfficial/WEB-LISANS-2025-2027/contents/package.json';
const GITHUB_DOWNLOAD_URL = 'https://github.com/EmirCobanOfficial/WEB-LISANS-2025-2027/archive/refs/heads/main.zip';

/**
 * Botu çalıştırmadan önce GitHub'dan güncellemeleri kontrol eder.
 * Yeni bir sürüm varsa indirir, kurar ve kullanıcıyı bilgilendirir.
 */
async function checkForUpdates() {
    // DÜZELTME: Gerekli modülleri sadece bu fonksiyon içinde require et.
    const fetch = require('node-fetch');
    const AdmZip = require('adm-zip');
    const { exec } = require('child_process');

    try {
        console.log('[Updater] Güncellemeler kontrol ediliyor...');
        const localPackageRaw = await fs.readFile('./package.json', 'utf8');
        const localPackage = JSON.parse(localPackageRaw);

        const headers = { 'Accept': 'application/vnd.github.v3.raw' };
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        console.log(`[Updater] Kontrol edilen URL: ${GITHUB_REPO_URL}`);

        const response = await fetch(GITHUB_REPO_URL, {
            headers: headers
        });

        if (response.status === 404) {
            console.warn(`[Updater] UYARI: Depo veya dosya bulunamadı (404).`);
            console.warn(`   - Depo gizli (Private) ise .env dosyasına GITHUB_TOKEN eklediğinizden emin olun.`);
            console.warn(`   - 'package.json' dosyası depo kök dizininde olmayabilir.`);
            return main(); // Hataya rağmen botu başlat
        }

        if (!response.ok) {
            throw new Error(`GitHub API'den yanıt alınamadı: ${response.statusText}`);
        }

        const remotePackageRaw = await response.text();
        const remotePackage = JSON.parse(remotePackageRaw);

        if (localPackage.version !== remotePackage.version) {
            console.log('======================================================');
            console.log(`🚀 YENİ GÜNCELLEME BULUNDU! Sürüm: ${remotePackage.version}`);
            console.log(`📦 Değişiklikler: ${remotePackage.description || 'Yeni özellikler eklendi ve performans iyileştirmeleri yapıldı.'}`);
            console.log('⬇️  Güncelleme indiriliyor ve kuruluyor...');
            console.log('======================================================');

            const updateResponse = await fetch(GITHUB_DOWNLOAD_URL);
            const updateZipPath = path.join(__dirname, 'update.zip');
            const fileStream = fsSync.createWriteStream(updateZipPath);
            await new Promise((resolve, reject) => {
                updateResponse.body.pipe(fileStream);
                updateResponse.body.on("error", reject);
                fileStream.on("finish", resolve);
            });
            console.log('[Updater] Güncelleme paketi indirildi.');

            const zip = new AdmZip(updateZipPath);
            const tempUpdateDir = path.join(__dirname, 'temp_update');

            if (fsSync.existsSync(tempUpdateDir)) {
                await fs.rm(tempUpdateDir, { recursive: true, force: true });
            }
            await fs.mkdir(tempUpdateDir);

            zip.extractAllTo(tempUpdateDir, true);

            const extractedFolders = await fs.readdir(tempUpdateDir);
            const sourceDir = path.join(tempUpdateDir, extractedFolders[0]);

            // DÜZELTME: Dosyaları kopyalamak için `fs.cp` kullanarak daha basit ve güvenilir bir yöntem kullan.
            // Bu yöntem, dosyaların ve klasörlerin doğru bir şekilde üzerine yazılmasını sağlar.
            const filesToCopy = await fs.readdir(sourceDir);
            for (const file of filesToCopy) {
                const sourcePath = path.join(sourceDir, file);
                const destPath = path.join(__dirname, file);

                // .env, db, uploads ve node_modules gibi korunacak dosyaları/klasörleri atla.
                if (file !== '.env' && file !== 'db' && file !== 'uploads' && file !== 'node_modules') {
                    // `fs.cp` komutu, hem dosyaları hem de klasörleri içerikleriyle birlikte
                    // kopyalar ve mevcut olanların üzerine yazar.
                    await fs.cp(sourcePath, destPath, { recursive: true, force: true });
                }
            }

            console.log('[Updater] Dosyalar başarıyla güncellendi.');

            await fs.unlink(updateZipPath);
            await new Promise(resolve => setTimeout(resolve, 200));
            await fs.rm(tempUpdateDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });

            // YENİ: Otomatik npm install işlemi
            console.log('[Updater] Yeni paketler yükleniyor (npm install)... Lütfen bekleyin.');
            await new Promise((resolve) => {
                exec('npm install', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Updater] npm install hatası: ${error.message}`);
                    } else {
                        console.log('[Updater] Paketler başarıyla güncellendi.');
                    }
                    resolve();
                });
            });

            console.log('[Updater] Bot PM2 ile başlatılmamış.');
            console.log('======================================================');
            console.log('✅ GÜNCELLEME TAMAMLANDI! Lütfen botu manuel olarak yeniden başlatın.');
            console.log('======================================================');
            process.exit(0);

        } else {
            console.log('[Updater] Botunuz güncel. Mevcut sürüm: ' + localPackage.version);
            await attemptStart(); // Güncelleme yoksa güvenli başlatmayı dene
        }
    } catch (error) {
        console.error('[Updater] Güncelleme kontrolü sırasında bir hata oluştu:', error.message);
        console.log('[Updater] Güncelleme kontrolü atlanıyor, bota devam ediliyor...');
        await attemptStart(); // Hata durumunda da güvenli başlatmayı dene
    }
}

/**
 * Botu başlatmayı dener. Eksik modül varsa otomatik yükler ve tekrar dener.
 */
async function attemptStart() {
    try {
        await main();
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.warn(`\n[Sistem] Eksik modül tespit edildi: ${error.message}`);
            console.log('[Sistem] Eksik modüller otomatik olarak yükleniyor (npm install)... Lütfen bekleyin.\n');
            
            const { exec } = require('child_process');
            await new Promise((resolve) => {
                exec('npm install', (err, stdout, stderr) => {
                    if (err) {
                        console.error(`[Sistem] npm install hatası: ${err.message}`);
                    } else {
                        console.log('[Sistem] Modüller başarıyla yüklendi.');
                    }
                    resolve();
                });
            });
            
            console.log('[Sistem] Bot tekrar başlatılıyor...\n');
            await main();
        } else {
            console.error('Bot başlatılırken kritik bir hata oluştu:', error);
            process.exit(1);
        }
    }
}

/**
 * Botun ana başlangıç fonksiyonu. Tüm başlatma işlemlerini sırayla yürütür.
 */
async function main() {
    // DÜZELTME: Tüm require'lar ve değişken tanımlamaları,
    // güncelleme ve lisans kontrolü SONRASINDA çalışacak olan bu fonksiyonun içine taşındı.
    // Bu, 'npm install' sonrası oluşabilecek 'module not found' hatalarını ve
    // 'Route.get() requires a callback function' hatasını önler.

    const crypto = require('crypto'); // DÜZELTME: Global yerine yerel değişken kullanıldı
    const { Client, GatewayIntentBits, Collection, ChannelType, PermissionsBitField, Partials, REST, Routes, Events, AuditLogEvent, Options, EmbedBuilder, MessageFlags, version: djsVersion } = require('discord.js');
    const express = require('express');
    const session = require('express-session');
    const passport = require('passport');
    const DiscordStrategy = require('passport-discord').Strategy;
    const fs = require('fs').promises; // Bu zaten en üstte var ama burada da olması zararsız.
    const fsSync = require('fs'); // Bu zaten en üstte var ama burada da olması zararsız.
    const path = require('path'); // Bu zaten en üstte var ama burada da olması zararsız.
    const os = require('os'); // HWID üretimi için eklendi
    const { DefaultExtractors } = require('@discord-player/extractor');
    const fetch = require('node-fetch');
    const playdl = require('play-dl');
    const ffmpeg = require('ffmpeg-static');
    const http = require('http');
    const { Server } = require('socket.io');

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    // Rota dosyalarını içe aktar
    const apiRoutes = require('./routes/api'); // Bu require'lar burada kalmalı.
    const guildRoutes = require('./routes/guild');

    // discord-player'ı burada require et
    const { Player } = require('discord-player');

    // ================== CONFIGURATION ==================
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;

    // YENİ: Kritik değişkenlerin kontrolü
    if (!CLIENT_ID || !CLIENT_SECRET || !BOT_TOKEN) {
        console.error("\n❌ KRİTİK HATA: Gerekli ortam değişkenleri eksik!");
        console.error(`   - BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
        console.error(`   - CLIENT_ID: ${CLIENT_ID ? '✅' : '❌'}`);
        console.error(`   - CLIENT_SECRET: ${CLIENT_SECRET ? '✅' : '❌'}`);
        console.error("   Lütfen .env dosyasını kontrol edin veya 'npm run setup' komutunu tekrar çalıştırın.\n");
        process.exit(1);
    }

    let APP_URL = process.env.APP_URL || 'http://localhost:3000';
    if (!APP_URL.startsWith('http://') && !APP_URL.startsWith('https://')) {
        APP_URL = `http://${APP_URL}`;
    }
    // YENİ: URL sonundaki olası fazladan eğik çizgiyi kaldır (Çift slash hatasını önler)
    APP_URL = APP_URL.replace(/\/$/, '');
    const port = process.env.PORT || 3000;
    const LICENSE_KEY = process.env.LICENSE_KEY; // DÜZELTME: TRUSTED_USERS'ı doğru şekilde ayrıştır
    const LICENSE_API_ENDPOINT = process.env.LICENSE_API_ENDPOINT;
    const TRUSTED_USERS = process.env.TRUSTED_USERS ? process.env.TRUSTED_USERS.split(',').map(id => id.trim()) : [];

    // --- DATABASE SETUP ---
    const dbFolderPath = path.join(__dirname, 'db');
    const settingsPath = path.join(dbFolderPath, 'settings.json');
    const backupsPath = path.join(dbFolderPath, 'backups');
    const uploadsPath = path.join(__dirname, 'uploads');
    const fontsPath = path.join(__dirname, 'fonts');
    const xpPath = path.join(dbFolderPath, 'xp.json');
    const registerStatsPath = path.join(dbFolderPath, 'register-stats.json');
    const economyPath = path.join(dbFolderPath, 'economy.json');
    const warningsPath = path.join(dbFolderPath, 'warnings.json');
    const authorizedUsersPath = path.join(dbFolderPath, 'authorized_users.json');
    const panelLogsPath = path.join(dbFolderPath, 'panel_logs.json');
    const blockedUsersPath = path.join(dbFolderPath, 'blocked_users.json');
    const panelTrustedUsersPath = path.join(dbFolderPath, 'panel_trusted_users.json'); // YENİ
    const scheduledTasksPath = path.join(dbFolderPath, 'scheduled_tasks.json'); // YENİ
    const savedPlaylistsPath = path.join(dbFolderPath, 'saved_playlists.json'); // YENİ
    let serverSettings = {};
    let xpData = {};
    // YENİ: Ayarları kaydetmek için kilit ve kuyruk mekanizması
    let isSavingSettings = false;
    let settingsSaveQueue = false;

    let registerStats = {};
    let economyData = {};
    let warningsData = {};
    let authorizedUsers = [];
    const userCooldowns = new Map();
    let blockedUsers = [];
    let panelTrustedUsers = []; // YENİ
    let panelLogs = [];
    let scheduledTasks = []; // YENİ
    let savedPlaylists = {}; // YENİ
    const economyCooldowns = new Map();
    const tempChannels = new Map();

    async function saveXpToFile() {
        try {
            await fs.writeFile(xpPath, JSON.stringify(xpData, null, 4));
        } catch (error) {
            console.error("Error saving XP data:", error);
        }
    }

    // YENİ: Zamanlanmış görevleri kaydet
    async function saveScheduledTasksToFile() {
        try {
            await fs.writeFile(scheduledTasksPath, JSON.stringify(scheduledTasks, null, 4));
        } catch (error) {
            console.error("Error saving scheduled tasks:", error);
        }
    }

    // YENİ: Kayıtlı çalma listelerini kaydet
    async function saveSavedPlaylistsToFile() {
        try {
            await fs.writeFile(savedPlaylistsPath, JSON.stringify(savedPlaylists, null, 4));
        } catch (error) {
            console.error("Error saving playlists:", error);
        }
    }

    async function saveEconomyDataToFile() {
        try {
            await fs.writeFile(economyPath, JSON.stringify(economyData, null, 4));
        } catch (error) {
            console.error("Error saving economy data:", error);
        }
    }

    async function saveRegisterStatsToFile() {
        try {
            await fs.writeFile(registerStatsPath, JSON.stringify(registerStats, null, 4));
        } catch (error) {
            console.error("Error saving register stats:", error);
        }
    }

    async function saveAuthorizedUsersToFile() {
        try {
            const recentUsers = authorizedUsers.slice(-50);
            await fs.writeFile(authorizedUsersPath, JSON.stringify(recentUsers, null, 4));
        } catch (error) {
            console.error("Error saving authorized users:", error);
        }
    }

    async function savePanelLogsToFile() {
        try {
            const recentLogs = panelLogs.slice(-200);
            await fs.writeFile(panelLogsPath, JSON.stringify(recentLogs, null, 4));
        } catch (error) {
            console.error("Error saving panel logs:", error);
        }
    }

    // YENİ: Engellenen kullanıcıları dosyaya kaydeder
    async function saveBlockedUsersToFile() {
        const tempPath = blockedUsersPath + '.tmp';
        try {
            await fs.writeFile(tempPath, JSON.stringify(blockedUsers, null, 4));
            await fs.rename(tempPath, blockedUsersPath);
        } catch (error) {
            console.error("Error saving blocked users:", error);
        }
    }

    // YENİ: Panelden eklenen güvenilir kullanıcıları dosyaya kaydeder
    async function savePanelTrustedUsersToFile() {
        const tempPath = panelTrustedUsersPath + '.tmp';
        try {
            await fs.writeFile(tempPath, JSON.stringify(panelTrustedUsers, null, 4));
            await fs.rename(tempPath, panelTrustedUsersPath);
        } catch (error) {
            console.error("Error saving panel trusted users:", error);
        }
    }


    async function saveWarningsToFile() {
        try {
            await fs.writeFile(warningsPath, JSON.stringify(warningsData, null, 4));
        } catch (error) {
            console.error("Error saving warnings data:", error);
        }
    }

    async function loadXpFromFile() {
        try {
            if (fsSync.existsSync(xpPath)) {
                const data = await fs.readFile(xpPath, 'utf-8');
                if (data) xpData = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading XP data:", error);
            xpData = {};
        }
    }

    async function loadEconomyDataFromFile() {
        try {
            if (fsSync.existsSync(economyPath)) {
                const data = await fs.readFile(economyPath, 'utf-8');
                if (data) economyData = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading economy data:", error);
            economyData = {};
        }
    }

    async function loadWarningsFromFile() {
        try {
            if (fsSync.existsSync(warningsPath)) {
                const data = await fs.readFile(warningsPath, 'utf-8');
                if (data) warningsData = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading warnings data:", error);
            warningsData = {};
        }
    }

    async function loadAuthorizedUsersFromFile() {
        try {
            if (fsSync.existsSync(authorizedUsersPath)) {
                const data = await fs.readFile(authorizedUsersPath, 'utf-8');
                if (data) authorizedUsers = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading authorized users:", error);
            authorizedUsers = [];
        }
    }

    // YENİ: Engellenen kullanıcıları dosyadan yükler
    async function loadBlockedUsersFromFile() {
        try {
            if (fsSync.existsSync(blockedUsersPath)) {
                const data = await fs.readFile(blockedUsersPath, 'utf-8');
                if (data) blockedUsers = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading blocked users:", error);
            blockedUsers = [];
        }
    }

    // YENİ: Panelden eklenen güvenilir kullanıcıları dosyadan yükler
    async function loadPanelTrustedUsersFromFile() {
        try {
            if (fsSync.existsSync(panelTrustedUsersPath)) {
                const data = await fs.readFile(panelTrustedUsersPath, 'utf-8');
                if (data) panelTrustedUsers = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading panel trusted users:", error);
            panelTrustedUsers = [];
        }
    }

    async function loadPanelLogsFromFile() {
        try {
            if (fsSync.existsSync(panelLogsPath)) {
                const data = await fs.readFile(panelLogsPath, 'utf-8');
                if (data) {
                    const parsedData = JSON.parse(data);
                    panelLogs = Array.isArray(parsedData) ? parsedData : [];
                }
            }
        } catch (error) {
            console.error("Error loading panel logs:", error);
            panelLogs = [];
        }
    }

    async function loadRegisterStatsFromFile() {
        try {
            if (fsSync.existsSync(registerStatsPath)) {
                const data = await fs.readFile(registerStatsPath, 'utf-8');
                if (data) registerStats = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading register stats:", error);
            registerStats = {};
        }
    }

    // YENİ: Zamanlanmış görevleri yükle
    async function loadScheduledTasksFromFile() {
        try {
            if (fsSync.existsSync(scheduledTasksPath)) {
                const data = await fs.readFile(scheduledTasksPath, 'utf-8');
                if (data) scheduledTasks = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading scheduled tasks:", error);
            scheduledTasks = [];
        }
    }

    // YENİ: Kayıtlı çalma listelerini yükle
    async function loadSavedPlaylistsFromFile() {
        try {
            if (fsSync.existsSync(savedPlaylistsPath)) {
                const data = await fs.readFile(savedPlaylistsPath, 'utf-8');
                if (data) savedPlaylists = JSON.parse(data);
            }
        } catch (error) {
            console.error("Error loading playlists:", error);
            savedPlaylists = {};
        }
    }

    /**
     * YENİ: Atomik yazma fonksiyonu. Veriyi önce geçici bir dosyaya yazar,
     * ardından asıl dosyanın üzerine taşıyarak veri bozulmasını önler.
     * @param {string} filePath - Asıl dosyanın yolu.
     * @param {string} data - Dosyaya yazılacak veri.
     */
    async function saveSettingsToFile() {
        // YENİ: Eğer bir kaydetme işlemi zaten devam ediyorsa, yeni bir isteği sıraya al ve çık.
        if (isSavingSettings) {
            settingsSaveQueue = true;
            return;
        }
    
        isSavingSettings = true; // Kilidi ayarla
        const tempPath = settingsPath + '.tmp';
    
        try {
            if (!fsSync.existsSync(dbFolderPath)) {
                await fs.mkdir(dbFolderPath, { recursive: true });
            }
    
            await fs.writeFile(tempPath, JSON.stringify(serverSettings, null, 4));
            await fs.rename(tempPath, settingsPath);
        } catch (error) {
            console.error("Error saving settings:", error);
        } finally {
            isSavingSettings = false; // Kilidi kaldır
    
            // YENİ: Eğer kuyrukta bekleyen bir istek varsa, onu çalıştır.
            if (settingsSaveQueue) {
                settingsSaveQueue = false; // Kuyruğu temizle
                saveSettingsToFile(); // Sıradaki işlemi başlat
            }
        }
    }

    async function loadSettingsFromFile() {
        try {
            if (!fsSync.existsSync(dbFolderPath)) await fs.mkdir(dbFolderPath, { recursive: true });
            if (!fsSync.existsSync(backupsPath)) await fs.mkdir(backupsPath, { recursive: true });
            if (!fsSync.existsSync(fontsPath)) await fs.mkdir(fontsPath, { recursive: true });
            if (!fsSync.existsSync(uploadsPath)) await fs.mkdir(uploadsPath, { recursive: true });
            if (fsSync.existsSync(settingsPath)) {
                const data = await fs.readFile(settingsPath, 'utf-8');
                if (data) {
                    serverSettings = JSON.parse(data);
                    console.log("✅ Settings loaded from db/settings.json");
                }
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            serverSettings = {};
        }
    }

    const client = new Client({
        intents: Object.values(GatewayIntentBits),
        partials: Object.values(Partials),
        makeCache: Options.cacheWithLimits({
            ...Options.DefaultMakeCacheSettings,
            MessageManager: 200,
        }),
    });

    client.player = new Player(client, {
        ytdlOptions: {
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
        },
        ffmpeg: ffmpeg,
        // DÜZELTME: play-dl zorlamasını kaldırarak varsayılan çıkarıcıları kullan (Stream hatalarını önler)
    });

    client.player.events.on('playerStart', (queue, track) => {
        console.log(`[Müzik] ${queue.guild.name}: ${track.title} çalmaya başladı.`);
        queue.metadata.channel.send(`🎵 Şimdi çalıyor: **${track.title}**`);
    });

    client.player.events.on('playerError', (queue, error) => {
        console.error(`[Müzik Hata] ${queue.guild.name}:`, error.message);
    });

    client.player.events.on('error', (queue, error) => {
        console.error(`[Genel Müzik Hata] ${queue.guild.name}:`, error.message);
    });

    function getLevelFromXP(xp) {
        return Math.floor(0.1 * Math.sqrt(xp));
    }

    function getXPForLevel(level) {
        return (level * level) * 100;
    }

    const auditLogEventNames = Object.fromEntries(
        Object.entries(AuditLogEvent).map(([key, value]) => [value, key])
    );

    // YENİ: Zamanlayıcı Döngüsü (Her 1 dakikada bir kontrol eder)
    setInterval(async () => {
        if (scheduledTasks.length === 0) return;

        const now = new Date();
        const tasksToRun = scheduledTasks.filter(task => new Date(task.executeAt) <= now);
        
        if (tasksToRun.length === 0) return;

        console.log(`[Scheduler] ${tasksToRun.length} adet zamanlanmış görev çalıştırılıyor...`);

        for (const task of tasksToRun) {
            let success = false;
            try {
                if (task.webhookUrl) {
                    const webhookClient = new WebhookClient({ url: task.webhookUrl });
                    await webhookClient.send(task.messageData);
                } else if (task.channelId) {
                    const channel = await client.channels.fetch(task.channelId).catch(() => null);
                    if (channel) await channel.send(task.messageData);
                }
                success = true;
            } catch (error) {
                console.error(`[Scheduler] Görev hatası (ID: ${task.id}):`, error.message);
            }

            // Tekrarlayan görev mantığı
            if (task.recurrence && task.recurrence !== 'once') {
                const nextDate = new Date(task.executeAt);
                if (task.recurrence === 'daily') {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (task.recurrence === 'weekly') {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (task.recurrence === 'monthly') {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                } else if (task.recurrence === 'specific_days' && task.selectedDays && task.selectedDays.length > 0) {
                    // Belirli günler mantığı
                    const currentDay = nextDate.getDay();
                    // Günleri sırala (0: Pazar, 1: Pzt, ...)
                    const sortedDays = task.selectedDays.sort((a, b) => a - b);
                    
                    // Bugünden sonraki ilk geçerli günü bul
                    let nextDay = sortedDays.find(d => d > currentDay);
                    
                    if (nextDay !== undefined) {
                        // Bu hafta içinde bir gün bulundu
                        nextDate.setDate(nextDate.getDate() + (nextDay - currentDay));
                    } else {
                        // Bu hafta bitti, sonraki haftanın ilk geçerli gününe git
                        nextDate.setDate(nextDate.getDate() + (7 - currentDay + sortedDays[0]));
                    }
                }
                
                // Eğer hesaplanan tarih geçmişte kaldıysa (bot kapalıyken kaçırılan döngüler), geleceğe taşı
                while (nextDate <= new Date()) {
                     if (task.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                     else if (task.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                     else if (task.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                     else if (task.recurrence === 'specific_days' && task.selectedDays) {
                        const currentDay = nextDate.getDay();
                        const sortedDays = task.selectedDays.sort((a, b) => a - b);
                        let nextDay = sortedDays.find(d => d > currentDay);
                        if (nextDay !== undefined) {
                            nextDate.setDate(nextDate.getDate() + (nextDay - currentDay));
                        } else {
                            nextDate.setDate(nextDate.getDate() + (7 - currentDay + sortedDays[0]));
                        }
                     } else {
                        // Bilinmeyen recurrence veya eksik selectedDays, döngüyü kır
                        console.warn(`[Scheduler] Görev (ID: ${task.id}) için geçersiz tekrar ayarı, döngü durduruldu.`);
                        break;
                     }
                }

                task.executeAt = nextDate.toISOString();
                console.log(`[Scheduler] Görev (ID: ${task.id}) tekrarlandı. Yeni zaman: ${task.executeAt}`);
            } else {
                // Tek seferlikse silinecek (aşağıdaki döngüde)
                task._shouldDelete = true;
            }
        }

        // Silinmesi gerekenleri temizle
        for (let i = scheduledTasks.length - 1; i >= 0; i--) {
            if (scheduledTasks[i]._shouldDelete) {
                scheduledTasks.splice(i, 1);
            }
        }

        await saveScheduledTasksToFile();

    }, 60 * 1000); // 60 saniye

    async function onReady() {
        server.listen(port, () => console.log(`🌐 Web Dashboard running at ${APP_URL}`));
        console.log(`🚀 Bot is online! Logged in as ${client.user.tag}`);

        await client.application.fetch();
        client.ownerId = client.application.owner.id;

        client.modules.forEach(module => {
            if (module.init) module.init(client, serverSettings, io);
        });

        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        try {
            console.log('(/) Slash komutları yenileniyor...');
            const commandsData = client.commands.map(cmd => cmd.data.toJSON());
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData });
            console.log('✅ Slash komutları başarıyla yenilendi.');
        } catch (error) {
            console.error("Slash komutları kaydedilirken hata oluştu:", error);
        }

        const botStatusModule = client.modules.get('botStatus');
        if (botStatusModule) {
            const statusSettings = serverSettings['global']?.[botStatusModule.name] || botStatusModule.getSettings();
            botStatusModule.updatePresence(client, statusSettings);
        }

        // YENİ: Bot başladığında kayıtlı banner'ı ayarla
        const bannerFileName = serverSettings.global?.botBanner?.fileName;
        if (bannerFileName) {
            const bannerPath = path.join(__dirname, 'uploads', bannerFileName);
            if (fsSync.existsSync(bannerPath)) {
                console.log('[Banner] Kayıtlı banner ayarlanıyor...');
                client.emit('setBotBanner', bannerPath);
            } else {
                console.warn(`[Banner] Kayıtlı banner dosyası bulunamadı: ${bannerFileName}`);
            }
        }
    }

    async function onMessageCreate(message) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        for (const module of client.modules.values()) {
            if (module.onMessage) {
                const handled = await module.onMessage(client, message, serverSettings);
                if (handled) return;
            }
        }

        const economySettings = serverSettings[guildId]?.economy;
        if (economySettings && economySettings.enabled && economySettings.moneyPerMessage > 0) {
            const economyCooldownKey = `eco-${guildId}-${userId}`;
            const economyNow = Date.now();
            const economyCooldownTime = 60 * 1000;

            if (!economyCooldowns.has(economyCooldownKey) || economyNow - economyCooldowns.get(economyCooldownKey) > economyCooldownTime) {
                economyCooldowns.set(economyCooldownKey, economyNow);

                if (!economyData[guildId]) economyData[guildId] = {};
                if (!economyData[guildId][userId]) {
                    economyData[guildId][userId] = { balance: 0, tag: message.author.tag };
                }

                const moneyToGive = economySettings.moneyPerMessage;
                economyData[guildId][userId].balance += moneyToGive;
                economyData[guildId][userId].tag = message.author.tag;
                await saveEconomyDataToFile();
            }
        }

        const settings = serverSettings[guildId]?.leveling;
        if (!settings || !settings.enabled) return;

        const cooldownKey = `${guildId}-${userId}`;
        const now = Date.now();
        const cooldownTime = 60 * 1000;
        if (userCooldowns.has(cooldownKey) && now - userCooldowns.get(cooldownKey) < cooldownTime) {
            return;
        }
        userCooldowns.set(cooldownKey, now);

        if (!xpData[guildId]) xpData[guildId] = {};
        if (!xpData[guildId][userId]) {
            xpData[guildId][userId] = { xp: 0, level: 0, tag: message.author.tag };
        }

        const xpToGive = Math.floor(Math.random() * ((settings.xpMax || 25) - (settings.xpMin || 15) + 1)) + (settings.xpMin || 15);
        const currentUserData = xpData[guildId][userId];
        currentUserData.xp += xpToGive;
        currentUserData.tag = message.author.tag;

        const newLevel = getLevelFromXP(currentUserData.xp);
        if (newLevel > currentUserData.level) {
            currentUserData.level = newLevel;
            if (settings.levelUpMessage && settings.levelUpChannelId) {
                const channel = await client.channels.fetch(settings.levelUpChannelId).catch(() => null);
                if (channel) {
                    const levelUpMsg = settings.levelUpMessage.replace('{user}', message.author.toString()).replace('{level}', newLevel);
                    channel.send(levelUpMsg).catch(console.error);
                }
            }
        }
        await saveXpToFile();
    }

    async function onGuildMemberAdd(member) {
        client.modules.forEach(module => {
            if (module.onGuildMemberAdd) module.onGuildMemberAdd(client, member, serverSettings);
        });
    }

    async function onGuildMemberRemove(member) {
        client.modules.forEach(module => {
            if (module.onGuildMemberRemove) module.onGuildMemberRemove(client, member, serverSettings);
        });
    }

    async function onSettingsUpdate(guildId, moduleName, newSettings, oldSettings) {
        const isGlobalModule = moduleName === 'botStatus';
        const logGuildId = isGlobalModule ? 'global' : guildId;

        console.log(`[Settings] Updating module '${moduleName}' for guild ${logGuildId}.`);
        const module = client.modules.get(moduleName);
        if (module && module.onSettingsUpdate) {
            if (isGlobalModule) {
                return module.onSettingsUpdate(client, newSettings, oldSettings);
            }
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) module.onSettingsUpdate(client, guild, newSettings, oldSettings);
        }
    }

    function onModerationLog(guild, type, targetUser, moderator, reason) {
        const modLogger = client.modules.get('moderationLogger');
        if (modLogger) {
            modLogger.addLog(guild.id, type, targetUser, moderator, reason);
        }
    }

    async function onAuditLogEntryCreate(auditLogEntry, guild) {
        const { action, executorId } = auditLogEntry;

        const guardSettings = serverSettings[guild.id]?.guard;
        if (!guardSettings || !guardSettings.enabled || !executorId) return;

        if (executorId === guild.ownerId || executorId === client.user.id) return;

        const executorMember = await guild.members.fetch(executorId).catch(() => null);
        if (!executorMember) return;
        if (guardSettings.safeRoles?.some(roleId => executorMember.roles.cache.has(roleId))) {
            return;
        }

        let reason = null;
        if (guardSettings.demoteOnDelete) {
            if (action === AuditLogEvent.ChannelDelete) reason = 'bir kanal sildiği';
            else if (action === AuditLogEvent.RoleDelete) reason = 'bir rol sildiği';
        }

        if (reason) {
            try {
                const rolesToRemove = executorMember.roles.cache.filter(role =>
                    role.permissions.has(PermissionsBitField.Flags.Administrator) ||
                    role.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                    role.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
                    role.permissions.has(PermissionsBitField.Flags.KickMembers) ||
                    role.permissions.has(PermissionsBitField.Flags.BanMembers)
                );

                if (rolesToRemove.size > 0) {
                    await executorMember.roles.remove(rolesToRemove, `Guard: ${reason} için yetkileri alındı.`);

                    if (guardSettings.logChannelId) {
                        const logChannel = await guild.channels.fetch(guardSettings.logChannelId).catch(() => null);
                        if (logChannel?.isTextBased()) {
                            const embed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('🛡️ Sunucu Koruması Devrede!')
                                .setDescription(`**${executorMember.user.tag}** adlı kullanıcının yetkileri, **${reason}** için otomatik olarak alındı.`)
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] });
                        }
                    }
                }
            } catch (error) {
                console.error(`[Guard] Yetki düşürme hatası (Guild: ${guild.id}, User: ${executorId}):`, error);
            }
        }
    }

    async function onVoiceStateUpdate(oldState, newState) {
        const { member, guild } = newState;
        const settings = serverSettings[guild.id]?.tempVoice;

        if (!settings || !settings.enabled) return;

        const creationChannelId = settings.creationChannelId;
        const categoryId = settings.categoryId;

        if (newState.channelId === creationChannelId) {
            const channelFormat = settings.channelNameFormat || '🔊 {user} Odası';
            const channelName = channelFormat.replace('{user}', member.displayName);
            try {
                const newChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers],
                        },
                    ],
                });
                await member.voice.setChannel(newChannel);
                tempChannels.set(newChannel.id, member.id);
            } catch (error) {
                console.error(`[TempVoice] Geçici kanal oluşturulamadı (Guild: ${guild.id}):`, error);
            }
        }

        if (oldState.channelId && tempChannels.has(oldState.channelId)) {
            const oldChannel = await guild.channels.fetch(oldState.channelId).catch(() => null);
            if (oldChannel && oldChannel.members.size === 0) {
                try {
                    await oldChannel.delete('Geçici kanal boşaldı.');
                    tempChannels.delete(oldChannel.id);
                } catch (error) {
                    if (error.code !== 10003) {
                        console.error(`[TempVoice] Geçici kanal silinemedi (Guild: ${guild.id}, Channel: ${oldState.channelId}):`, error);
                    }
                    tempChannels.delete(oldState.channelId);
                }
            }
        }
    }

    if (process.env.YOUTUBE_COOKIE_PATH) {
        try {
            await playdl.setToken({ youtube: { cookie: process.env.YOUTUBE_COOKIE_PATH } });
            console.log('✅ YouTube çerezleri başarıyla ayarlandı.');
        } catch (e) { console.error('❌ YouTube çerezleri ayarlanamadı:', e.message); }
    }

    await client.player.extractors.loadMulti(DefaultExtractors, {});

    await loadSettingsFromFile();
    await loadXpFromFile();
    await loadEconomyDataFromFile();
    await loadWarningsFromFile();
    await loadPanelTrustedUsersFromFile(); // YENİ
    await loadBlockedUsersFromFile(); // YENİ
    await loadAuthorizedUsersFromFile();
    await loadPanelLogsFromFile();
    await loadRegisterStatsFromFile();
    await loadScheduledTasksFromFile(); // YENİ
    await loadSavedPlaylistsFromFile(); // YENİ

    if (!serverSettings['global']) {
        serverSettings['global'] = {};
    }

    client.commands = new Collection();
    const commandsPath = path.join(__dirname, 'commands');
    if (!fsSync.existsSync(commandsPath)) await fs.mkdir(commandsPath);

    app.use(express.json({ limit: '10mb' }));
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'public', 'views')); // DÜZELTME: Doğru klasörü göster
    app.use(express.static(path.join(__dirname, 'public'))); // 'public' klasörünü statik olarak sunmaya devam et
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    
    // GÜVENLİK GÜNCELLEMESİ: Session güvenliği artırıldı
    const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
    app.use(session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: APP_URL.startsWith('https'), // HTTPS kullanılıyorsa secure cookie açılır
            httpOnly: true, // XSS saldırılarına karşı koruma
            maxAge: 1000 * 60 * 60 * 24 // 1 gün
        }
    }));

    // GÜVENLİK: CSRF Koruması Middleware
    app.use((req, res, next) => {
        // Token oluştur (yoksa)
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }
        // Token'ı view'lara gönder (EJS içinde kullanmak için)
        res.locals.csrfToken = req.session.csrfToken;

        // Sadece veri değiştiren metodları kontrol et (GET, HEAD, OPTIONS hariç)
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

        const token = req.body?._csrf || req.query?._csrf || req.headers['x-csrf-token'];
        if (token !== req.session.csrfToken) {
            return res.status(403).json({ error: 'CSRF token mismatch. Lütfen sayfayı yenileyip tekrar deneyin.' });
        }
        next();
    });

    app.use(passport.initialize());
    app.use(passport.session());
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    passport.use(new DiscordStrategy({ clientID: CLIENT_ID, clientSecret: CLIENT_SECRET, callbackURL: `${APP_URL}/auth/callback`, scope: ['identify', 'guilds'] }, (accessToken, refreshToken, profile, done) => done(null, profile)));

    // YENİ: Kullanıcının engelli olup olmadığını KÜRESEL olarak kontrol eden ara katman
    // Bu middleware, passport'tan hemen sonra gelerek tüm kimlik doğrulanmış istekleri kontrol eder.
    app.use((req, res, next) => {
        if (req.isAuthenticated()) {
            // Bot sahibi veya güvenilir kullanıcılar asla engellenemez
            const isOwnerOrTrusted = (client.ownerId && req.user.id === client.ownerId) || TRUSTED_USERS.includes(req.user.id);
            if (!isOwnerOrTrusted && blockedUsers.includes(req.user.id)) {
                req.logout(err => {
                    if (err) return next(err);
                    return res.sendFile(path.join(__dirname, 'public', 'blocked.html'));
                });
                return; // Yönlendirme yapıldığı için sonraki adıma geçme
            }
        }
        next(); // Engelli değilse veya giriş yapmamışsa devam et
    });

    const db = {
        saveSettingsToFile, saveXpToFile, saveEconomyDataToFile, economyData,
        saveWarningsToFile, warningsData, economyCooldowns, saveRegisterStatsToFile,
        getLevelFromXP, authorizedUsers, player: client.player, panelLogs, getXPForLevel,
        blockedUsers, saveBlockedUsersToFile,
        backupsPath, auditLogEventNames, registerStats, fs, fsSync,
        scheduledTasks, saveScheduledTasksToFile, // YENİ
        savedPlaylists, saveSavedPlaylistsToFile // YENİ
    };

    const checkAuth = (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect('/login');
    };

    // YENİ: Sadece bot sahibinin erişebileceği rotaları kontrol eden ara katman
    const isOwner = (req, res, next) => {
        if (req.isAuthenticated() && (
            (client.ownerId && req.user.id === client.ownerId) || 
            TRUSTED_USERS.includes(req.user.id) ||
            panelTrustedUsers.includes(req.user.id) // YENİ: Panelden eklenenleri de kontrol et
        )) return next();
        
        // YENİ: HTML isteği ise unauthorized sayfasını göster
        if (req.accepts('html')) {
            return res.status(403).render('unauthorized', { user: req.user });
        }
        res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok.' });
    };

    app.use('/api', (req, res, next) => {
        if (req.method === 'GET' || !req.isAuthenticated()) {
            return next();
        }
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const user = req.user;
                const guildId = req.body.guildId || req.params.guildId;
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    userId: user.id,
                    userTag: `${user.username}#${user.discriminator}`,
                    guildId: guildId || 'Bilinmiyor',
                    action: `${req.method} ${req.originalUrl}`,
                    status: res.statusCode
                };
                panelLogs.push(logEntry);
                savePanelLogsToFile();
            }
        });
        next();
    });

    // --- YENİ: ÖZEL VE YETKİLİ API ROTALARI ---
    // Bu rotalar, genel rotalardan ÖNCE gelmelidir.

    // Engellenen kullanıcıları yönetir (Sadece bot sahibi)
    app.get('/api/blocked-users', isOwner, (req, res) => res.json(blockedUsers));
    app.post('/api/block-user', isOwner, async (req, res) => {
        const { userId } = req.body;
        if (!userId || !/^\d{17,19}$/.test(userId)) return res.status(400).json({ error: 'Geçersiz kullanıcı ID\'si.' });
        if (!blockedUsers.includes(userId)) {
            blockedUsers.push(userId);
            await saveBlockedUsersToFile();
            res.json({ message: `Kullanıcı (${userId}) başarıyla engellendi.` });
        } else {
            res.status(409).json({ error: 'Bu kullanıcı zaten engellenmiş.' });
        }
    });
    app.delete('/api/blocked-users/:userId', isOwner, async (req, res) => {
        blockedUsers = blockedUsers.filter(id => id !== req.params.userId);
        await saveBlockedUsersToFile();
        res.json({ message: `Kullanıcının (${req.params.userId}) engeli kaldırıldı.` });
    });

    // Panel loglarını ve giriş yapanları getirir (Sadece bot sahibi)
    app.get('/api/authorized-users', isOwner, (req, res) => res.json(authorizedUsers));
    app.get('/api/panel-logs', isOwner, (req, res) => res.json(panelLogs));

    // YENİ: Güvenilir kullanıcıları yöneten rotalar (Sadece bot sahibi ve .env'dekiler)
    // YENİ: Panel loglarını silme rotası (Sadece bot sahibi)
    app.delete('/api/panel-logs', isOwner, async (req, res) => {
        try {
            panelLogs = []; // Bellekteki logları temizle
            await savePanelLogsToFile(); // Dosyadaki logları temizle (boş diziyi kaydet)
            res.json({ success: true, message: 'Tüm panel işlem logları başarıyla silindi.' });
        } catch (error) {
            console.error('Panel logları silinirken hata:', error);
            res.status(500).json({ error: 'Loglar silinirken bir sunucu hatası oluştu.' });
        }
    });

    const isSuperAdmin = (req, res, next) => {
        if (req.isAuthenticated() && ((client.ownerId && req.user.id === client.ownerId) || TRUSTED_USERS.includes(req.user.id))) return next();
        res.status(403).json({ error: 'Bu işlemi yapma yetkiniz yok.' });
    };

    app.get('/api/trusted-users', isSuperAdmin, (req, res) => {
        res.json(panelTrustedUsers);
    });

    app.post('/api/trusted-users', isSuperAdmin, async (req, res) => {
        const { userId } = req.body;
        if (!userId || !/^\d{17,19}$/.test(userId)) return res.status(400).json({ error: 'Geçersiz kullanıcı ID\'si.' });
        if (!panelTrustedUsers.includes(userId)) {
            panelTrustedUsers.push(userId);
            await savePanelTrustedUsersToFile();
            res.json({ message: `Kullanıcı (${userId}) güvenilir listesine eklendi.` });
        } else {
            res.status(409).json({ error: 'Bu kullanıcı zaten güvenilir listesinde.' });
        }
    });
    app.delete('/api/trusted-users/:userId', isSuperAdmin, async (req, res) => {
        panelTrustedUsers = panelTrustedUsers.filter(id => id !== req.params.userId);
        await savePanelTrustedUsersToFile();
        res.json({ message: `Kullanıcı (${req.params.userId}) güvenilir listesinden kaldırıldı.` });
    });

    // --- GENEL API ROTALARI ---
    app.use('/api', apiRoutes(client, checkAuth, auditLogEventNames, db)); // db eklendi
    app.use('/api', guildRoutes(client, checkAuth, isOwner, serverSettings, xpData, db));


    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    app.get('/', checkAuth, (req, res) => { // checkAuth burada kalmalı
        res.render('index', {
            user: req.user,
            clientId: CLIENT_ID,
            USER_ID: req.user.id,
            csrfToken: req.session.csrfToken, // CSRF Token'ı view'a gönder
            isBotOwner: String(!!(
                (client.ownerId && req.user.id === client.ownerId) ||
                TRUSTED_USERS.includes(req.user.id) ||
                panelTrustedUsers.includes(req.user.id) // DÜZELTME: Panelden eklenen güvenilir kullanıcıları da kontrol et
            ))
        });
    });

    // GÜNCELLENDİ: Beni Hatırla desteği için ara katman
    app.get('/auth/login', (req, res, next) => {
        if (req.query.remember === 'true') {
            req.session.rememberMe = true;
        }
        next();
    }, passport.authenticate('discord'));

    app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => {
        const user = req.user;
        
        // YENİ: Beni Hatırla Mantığı
        if (req.session.rememberMe) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 Gün
            delete req.session.rememberMe; // Flag'i temizle
        } else {
            req.session.cookie.expires = false; // Tarayıcı kapanınca oturum sonlansın
        }

        const existingUser = authorizedUsers.find(u => u.id === user.id);
        if (existingUser) {
            existingUser.timestamp = new Date().toISOString();
            existingUser.tag = `${user.username}#${user.discriminator}`;
        } else {
            authorizedUsers.push({
                id: user.id,
                tag: `${user.username}#${user.discriminator}`,
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
                timestamp: new Date().toISOString()
            });
        }
        saveAuthorizedUsersToFile();
        res.redirect('/');
    });
    app.get('/auth/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/login');
        });
    });

    const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[UYARI] ${file} komutunda 'data' veya 'execute' özelliği eksik.`);
        }
    }

    client.on(Events.InteractionCreate, async interaction => {
        if (client.giveawaysManager?.onInteraction) {
            await client.giveawaysManager.onInteraction(interaction);
        }

        client.modules.forEach(module => {
            if (module.onInteraction) {
                module.onInteraction(interaction, serverSettings);
            }
        });

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction, serverSettings, db);
            } catch (error) {
                console.error(`Komut hatası (${interaction.commandName}):`, error);
                interaction.reply({ content: 'Bu komutu çalıştırırken bir hata oluştu!', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    });

    client.on(Events.MessageCreate, onMessageCreate);

    const modulesPath = path.join(__dirname, 'modules');
    client.modules = new Collection();
    const moduleFiles = (await fs.readdir(modulesPath)).filter(file => file.endsWith('.js'));
    for (const file of moduleFiles) {
        const module = require(path.join(modulesPath, file));
        client.modules.set(module.name, module);
    }

    client.once(Events.ClientReady, onReady);
    client.on(Events.GuildMemberAdd, onGuildMemberAdd);
    client.on(Events.GuildMemberRemove, onGuildMemberRemove);
    client.on('settingsUpdate', onSettingsUpdate);
    client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);
    client.on(Events.GuildAuditLogEntryCreate, onAuditLogEntryCreate);
    client.on('moderationLog', onModerationLog);
    client.on('error', error => console.error('Discord Client Hatası:', error));
    
    // YENİ: Bot banner'ını ayarlamak için olay dinleyicisi
    client.on('setBotBanner', async (filePath, callback) => {
        try {
            // DÜZELTME: Hatalı hash karşılaştırma mantığı kaldırıldı.
            const imageBuffer = await fs.readFile(filePath);
            await client.user.setBanner(imageBuffer);
            console.log('[Banner] Bot banner\'ı başarıyla güncellendi.');
            if (callback) callback(null, { success: true });
        } catch (error) {
            console.error('[Banner] Bot banner\'ı güncellenirken hata oluştu:', error);
            if (callback) callback(error);
        }
    });

    try {
        if (!LICENSE_KEY || !LICENSE_API_ENDPOINT) {
            console.error("❌ LİSANS HATASI: .env dosyasında LICENSE_KEY veya LICENSE_API_ENDPOINT eksik!");
            process.exit(1);
        }

        console.log("[DEBUG] Lisans anahtarı doğrulanıyor...");
        
        // YENİ: Sunucuya özel HWID (Hardware ID) üretimi
        // Bu işlem, lisansın sadece bu makinede çalışmasını sağlar.
        const interfaces = os.networkInterfaces();
        let mac = '';
        for (const key in interfaces) {
            for (const iface of interfaces[key]) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    mac = iface.mac;
                    break;
                }
            }
            if (mac) break;
        }
        const hwid = crypto.createHash('md5').update(mac || os.hostname()).digest('hex').toUpperCase();
        console.log(`[DEBUG] Makine HWID: ${hwid}`);

        const response = await require('node-fetch')(LICENSE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey: LICENSE_KEY,
                clientId: hwid, // Discord Client ID yerine HWID kullan
            }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Geçersiz lisans anahtarı veya sunucu hatası.');
        }
        console.log("✅ Lisans anahtarı başarıyla doğrulandı.");

        console.log("[DEBUG] Attempting to log in to Discord...");
        await client.login(BOT_TOKEN);
    } catch (error) {
        console.error("❌ Bot başlatılırken kritik bir hata oluştu:", error.message);
        process.exit(1);
    }
}

// DÜZELTME: Botu her zaman güncelleme kontrolü yaparak başlat.
checkForUpdates();
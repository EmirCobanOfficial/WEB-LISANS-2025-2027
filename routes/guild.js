const express = require('express');
const { ChannelType, PermissionsBitField, Collection, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const { Rcon } = require('rcon-client');
const path = require('path');
const multer = require('multer');

// Multer yapılandırması (Dosya Yükleme için)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Dosyaların kaydedileceği klasör
    },
    filename: function (req, file, cb) {
        // DÜZELTME: Rota türüne göre dosya adını dinamik olarak oluştur.
        const type = req.params.imageType || file.fieldname; // 'bot/banner' rotası için 'banner' kullanılır.
        const guildId = req.params.guildId || 'global'; // Guild ID yoksa 'global' kullan.
        cb(null, `${type}-${guildId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Bu fonksiyon, bot.js'den gerekli bağımlılıkları alacak
module.exports = (client, checkAuth, isOwner, serverSettings, xpData, db) => {
    const router = express.Router();
    const {
        saveSettingsToFile,
        saveXpToFile,
        saveRegisterStatsToFile, // YENİ
        getLevelFromXP,
        getXPForLevel,
        backupsPath,
        fs, fsSync,
        auditLogEventNames,
        registerStats, // YENİ
        authorizedUsers, // YENİ: Giriş yapan kullanıcıları çekmek için
        panelLogs, // YENİ: Panel loglarını çekmek için
        player // YENİ: Müzik çaları rotalara aktar
    } = db;
    // db nesnesinden warningsData ve saveWarningsToFile'ı al
    const { warningsData, saveWarningsToFile } = db;

    // =================================================================
    // AYARLAR (SETTINGS)
    // =================================================================
    router.get('/settings', checkAuth, async (req, res) => { // Make it async
        const { guildId } = req.query;
        if (!guildId) return res.status(400).json({ error: 'Guild kimliği gereklidir.' });

        try {
            // Botun sunucuda olup olmadığını kontrol et
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            console.error(`Ayarlar alınırken hata (Guild: ${guildId}):`, e);
            return res.status(500).json({ error: 'Ayarlar alınırken bir sunucu hatası oluştu.' });
        }

        if (!serverSettings[guildId]) {
            serverSettings[guildId] = {};
        }

        let settingsUpdated = false;
        client.modules.forEach(module => {
            if (module.getSettings && !serverSettings[guildId][module.name]) {
                serverSettings[guildId][module.name] = module.getSettings();
                settingsUpdated = true;
            }
        });

        if (settingsUpdated) saveSettingsToFile();

        res.json(serverSettings[guildId]);
    });

    // Ayarları kaydeden rota
    router.post('/settings', checkAuth, async (req, res) => {
        const { guildId, module: moduleName, newSettings } = req.body;
        if (!guildId || !moduleName || !newSettings) {
            return res.status(400).json({ error: 'Geçersiz istek.' });
        }
        try {
            // DÜZELTME: Global ayarlar için sunucu kontrolü yapma
            if (guildId !== 'global') await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e; // Diğer hataları yakalamak için fırlat
        }

        // Global ayarlar (botStatus gibi) ve sunucuya özel ayarlar için hedef nesneyi belirle
        const isGlobal = guildId === 'global';

        if (isGlobal && req.user.id !== client.ownerId) {
            return res.status(403).json({ error: 'Bu ayarı sadece bot sahibi değiştirebilir.' });
        }

        const targetSettings = isGlobal ? serverSettings.global : serverSettings[guildId];

        if (!targetSettings) {
            return res.status(404).json({ error: 'Ayar hedefi bulunamadı.' });
        }
        if (!targetSettings[moduleName]) targetSettings[moduleName] = {};

        const oldSettings = JSON.parse(JSON.stringify(targetSettings[moduleName] || {}));
        Object.assign(targetSettings[moduleName], newSettings);
        await saveSettingsToFile();

        // YENİ: Eğer istatistikler sıfırlanıyorsa (gelecekteki bir özellik için), bellekten ve dosyadan sil
        if (moduleName === 'register' && newSettings.resetStats === true) {
            if (registerStats && registerStats[guildId]) delete registerStats[guildId];
            await saveRegisterStatsToFile();
            delete newSettings.resetStats; // Bu ayarı ana ayar dosyasına kaydetme
        }

        client.emit('settingsUpdate', guildId, moduleName, serverSettings[guildId][moduleName], oldSettings);

        res.json({ success: true });
    });

    // Ayarları sıfırlayan rota
    router.delete('/guild/:guildId/settings', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || !(new PermissionsBitField(BigInt(guild.permissions)).has('ManageGuild'))) {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            return res.status(403).json({ error: 'Bu sunucuda ayarları sıfırlama yetkiniz yok.' });
        }
        try {
            if (serverSettings[guildId]) {
                delete serverSettings[guildId];
                await saveSettingsToFile();
                res.json({ message: 'Tüm ayarlar başarıyla sıfırlandı.' });
            } else {
                res.json({ message: 'Sıfırlanacak ayar bulunamadı, işlem başarılı sayıldı.' });
            }
        } catch (error) {
            console.error(`Ayarlar sıfırlanırken hata (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Ayarlar sıfırlanırken bir sunucu hatası oluştu.' });
        }
    });

    // Ayarları içe aktaran rota
    router.post('/guild/:guildId/settings/import', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const newSettings = req.body;
        if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
            return res.status(400).json({ error: 'Geçersiz ayar formatı. Bir JSON nesnesi bekleniyor.' });
        }
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        const guild = req.user.guilds.find(g => g.id === guildId);
        if (!guild || !(new PermissionsBitField(BigInt(guild.permissions)).has('ManageGuild'))) {
            return res.status(403).json({ error: 'Bu sunucuda ayarları içe aktarma yetkiniz yok.' });
        }
        try {
            serverSettings[guildId] = newSettings;
            await saveSettingsToFile();
            Object.keys(newSettings).forEach(moduleName => {
                client.emit('settingsUpdate', guildId, moduleName, newSettings[moduleName], {});
            });
            res.json({ message: 'Tüm ayarlar başarıyla içe aktarıldı.' });
        } catch (error) {
            console.error(`Ayarlar içe aktarılırken hata (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Ayarlar içe aktarılırken bir sunucu hatası oluştu.' });
        }
    });

    // Eklenti kartı sıralamasını kaydeden rota
    router.post('/guild/:guildId/plugin-order', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const { gridId, order } = req.body;

        if (!gridId || !Array.isArray(order)) {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            return res.status(400).json({ error: 'Geçersiz istek: gridId ve order gereklidir.' });
        }

        try {
            if (!serverSettings[guildId]) serverSettings[guildId] = {};
            if (!serverSettings[guildId].pluginOrders) serverSettings[guildId].pluginOrders = {};

            serverSettings[guildId].pluginOrders[gridId] = order;
            await saveSettingsToFile();

            res.json({ success: true, message: 'Sıralama kaydedildi.' });
        } catch (error) {
            console.error(`Eklenti sıralaması kaydedilirken hata (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Sıralama kaydedilirken bir sunucu hatası oluştu.' });
        }
    });

    // YENİ: Karşılama/Uğurlama arkaplan resmini yükleme rotası
    router.post('/guild/:guildId/upload-welcome-image/:imageType', checkAuth, upload.single('backgroundImage'), async (req, res) => {
        const { guildId, imageType } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'Dosya yüklenmedi.' });
        }

        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        // imageType 'welcome' veya 'goodbye' olmalı
        if (imageType !== 'welcome' && imageType !== 'goodbye') {
            return res.status(400).json({ error: 'Geçersiz resim türü.' });
        }

        try {
            const settingKey = imageType === 'welcome' ? 'welcomeBackgroundImage' : 'goodbyeBackgroundImage';
            const oldFileName = serverSettings[guildId]?.welcome?.[settingKey];

            // Eski dosyayı sil (varsa)
            if (oldFileName) {
                const oldPath = path.join(__dirname, '..', 'uploads', oldFileName);
                if (fsSync.existsSync(oldPath)) await fs.unlink(oldPath);
            }

            // Yeni dosya adını ayara kaydet
            serverSettings[guildId].welcome[settingKey] = req.file.filename;
            await saveSettingsToFile();
            res.json({ success: true, message: 'Resim başarıyla yüklendi.', filePath: `/uploads/${req.file.filename}` });
        } catch (error) {
            res.status(500).json({ error: 'Resim yüklenirken bir hata oluştu.' });
        }
    });

    // YENİ: Botun sunucudaki izinlerini kontrol eden rota
    router.get('/guild/:guildId/permissions-check', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            const me = guild.members.me;

            const requiredPermissions = [
                { flag: 'ViewChannel', name: 'Kanalları Gör' },
                { flag: 'ManageRoles', name: 'Rolleri Yönet' },
                { flag: 'ManageChannels', name: 'Kanalları Yönet' },
                { flag: 'ViewAuditLog', name: 'Denetim Kaydını Görüntüle' },
                { flag: 'ManageGuild', name: 'Sunucuyu Yönet' },
                { flag: 'BanMembers', name: 'Üyeleri Yasakla' },
                { flag: 'KickMembers', name: 'Üyeleri At' },
                { flag: 'SendMessages', name: 'Mesaj Gönder' },
                { flag: 'EmbedLinks', name: 'Bağlantı Göm' },
            ];

            const missingPermissions = requiredPermissions.filter(p => 
                !me.permissions.has(PermissionsBitField.Flags[p.flag])
            );

            if (missingPermissions.length > 0) {
                res.status(403).json({
                    error: 'Botun bazı temel izinleri eksik.',
                    missing: missingPermissions.map(p => p.name)
                });
            } else {
                res.json({ success: true, message: 'Tüm temel izinler mevcut.' });
            }
        } catch (e) {
            res.status(500).json({ error: 'İzinler kontrol edilirken bir hata oluştu.' });
        }
    });

    // =================================================================
    // SUNUCU BİLGİLERİ (CHANNELS, ROLES, MEMBERS)
    // =================================================================
    router.get('/guild/:guildId/channels', checkAuth, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(req.params.guildId);
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const channelManager = guild.channels;
            const channels = (await channelManager.fetch())
                .filter(c => [
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.GuildVoice,
                    ChannelType.GuildCategory,
                    ChannelType.GuildStageVoice,
                    ChannelType.GuildForum,
                ].includes(c.type))
                .map(c => ({ id: c.id, name: c.name, type: c.type }))
                .sort((a, b) => a.name.localeCompare(b.name));
            res.json(channels);
        } catch (e) { res.status(500).json({ error: 'Kanalları alamadı.' }); }
    });
    // Rolleri getiren rota
    router.get('/guild/:guildId/roles', checkAuth, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(req.params.guildId);
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const roleManager = guild.roles;
            const roles = (await roleManager.fetch())
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(r => ({
                    id: r.id,
                    name: r.name,
                    color: r.hexColor,
                    permissions: r.permissions.bitfield.toString()
                }));
            res.json(roles);
        } catch (e) { res.status(500).json({ error: 'Roller alınamadı.' }); }
    });
    // Rol oluşturan rota
    router.post('/guild/:guildId/roles', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const { name, color, permissions } = req.body;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return res.status(403).json({ error: "Bot'un 'Rolleri Yönet' izni yok." });
            }
            const newRole = await guild.roles.create({ name, color, permissions: BigInt(permissions || 0) });
            res.json({ success: true, role: { id: newRole.id, name: newRole.name, color: newRole.hexColor, permissions: newRole.permissions.bitfield.toString() } });
        } catch (e) {
            console.error(`Rol oluşturulurken hata (Guild: ${guildId}):`, e);
            res.status(500).json({ error: 'Rol oluşturulamadı.' });
        }
    });
    // Rolü güncelleyen rota
    router.patch('/guild/:guildId/roles/:roleId', checkAuth, async (req, res) => {
        const { guildId, roleId } = req.params;
        const { name, color, permissions } = req.body;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return res.status(403).json({ error: "Bot'un 'Rolleri Yönet' izni yok." });
            }
            const role = await guild.roles.fetch(roleId);
            if (!role || !role.editable) {
                return res.status(404).json({ error: 'Rol bulunamadı veya düzenlenemiyor.' });
            }
            const updatedRole = await role.edit({ name, color: color, permissions: BigInt(permissions || 0) });
            res.json({ success: true, role: { id: updatedRole.id, name: updatedRole.name, color: updatedRole.hexColor, permissions: updatedRole.permissions.bitfield.toString() } });
        } catch (e) {
            console.error(`Rol güncellenirken hata (Guild: ${guildId}, Role: ${roleId}):`, e);
            res.status(500).json({ error: 'Rol güncellenemedi.' });
        }
    });
    // Rolü silen rota
    router.delete('/guild/:guildId/roles/:roleId', checkAuth, async (req, res) => {
        const { guildId, roleId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            const role = await guild.roles.fetch(roleId);
            if (!role || !role.editable) {
                return res.status(404).json({ error: 'Rol bulunamadı veya silinemiyor.' });
            }
            await role.delete('Dashboard üzerinden silindi.');
            res.json({ success: true });
        } catch (e) {
            console.error(`Rol silinirken hata (Guild: ${guildId}, Role: ${roleId}):`, e);
            res.status(500).json({ error: 'Rol silinemedi.' });
        }
    });
    // Üyeleri getiren rota
    router.get('/guild/:guildId/members', checkAuth, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(req.params.guildId);
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return res.status(403).json({ error: "Bot'un üyeleri ve rolleri görebilmesi için 'Rolleri Yönet' izni gereklidir." });
            }
            // PERFORMANS İYİLEŞTİRMESİ: Tüm üyeleri her seferinde çekmek yerine cache'i kullan.
            // Eğer üye listesi eksikse, botun "SERVER MEMBERS INTENT" izninin Discord Developer Portal'da açık olduğundan emin olun.
            // await guild.members.fetch(); // Bu satır büyük sunucularda aşırı yavaşlığa neden olur.
            const members = guild.members.cache.map(member => ({
                id: member.id,
                tag: member.user.tag,
                avatar: member.user.displayAvatarURL(),
                roles: member.roles.cache.filter(r => r.id !== guild.id).map(role => role.id)
            }));
            res.json(members);
        } catch (e) {
            console.error(`Üyeler alınırken hata (Guild: ${req.params.guildId}):`, e);
            res.status(500).json({ error: 'Üyeler alınamadı.' });
        }
    });
    // Üye rollerini güncelleyen rota
    router.post('/guild/:guildId/members/:memberId/roles', checkAuth, async (req, res) => {
        const { guildId, memberId } = req.params;
        const { roles } = req.body;
        if (!Array.isArray(roles)) return res.status(400).json({ error: 'Roller bir dizi (array) formatında olmalıdır.' });
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return res.status(403).json({ error: "Bot'un 'Rolleri Yönet' izni yok." });
            }
            const member = await guild.members.fetch(memberId);
            await member.roles.set(roles);
            res.json({ success: true, message: 'Üye rolleri başarıyla güncellendi.' });
        } catch (error) {
            // HATA YÖNETİMİ İYİLEŞTİRMESİ: Missing Permissions hatasını daha detaylı logla ve kullanıcıya bildir.
            if (error.code === 50013) { // Missing Permissions
                console.error(
                    `[YETKİ HATASI] (Guild: ${guildId}, Member: ${memberId}): Botun rolü, üyeye atanan veya üyeden alınan rollerden daha yüksek bir pozisyonda değil. Lütfen Discord sunucu ayarlarından botun rolünü en üste taşıyın.`
                );
                return res.status(403).json({
                    error: 'Botun yetkisi yetersiz. Botun rolünün, yönetilen rollerden daha yüksek bir hiyerarşide olduğundan emin olun.'
                });
            }
            // Diğer hatalar için genel loglama
            console.error(`Üye rolleri güncellenirken hata (Guild: ${guildId}, Member: ${memberId}):`, error);
            if (error.code === 50001) { // Missing Access
                return res.status(403).json({ error: "Bot bu üyeye erişemiyor. Üye sunucudan ayrılmış olabilir." });
            }
            res.status(500).json({ error: 'Roller güncellenemedi. Lütfen botun rol hiyerarşisini ve izinlerini kontrol edin.' });
        }
    });

    // =================================================================
    // İSTATİSTİKLER VE LOGLAR (STATS, LOGS, LEADERBOARD)
    // =================================================================
    router.get('/guild/:guildId/invites', checkAuth, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(req.params.guildId);
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return res.status(403).json({ error: "Bot'un 'Sunucuyu Yönet' izni yok." });
            }
            const invites = await guild.invites.fetch({ cache: false });
            const inviteData = invites.map(invite => ({
                code: invite.code,
                uses: invite.uses,
                maxUses: invite.maxUses,
                inviter: invite.inviter ? invite.inviter.tag : 'Bilinmiyor',
                channel: invite.channel ? invite.channel.name : 'Bilinmiyor',
                expiresAt: invite.expiresTimestamp,
                url: invite.url
            }));
            res.json(inviteData);
        } catch (e) { res.status(500).json({ error: 'Davetler alınamadı.' }); }
    });

    router.delete('/guild/:guildId/invites/:inviteCode', checkAuth, async (req, res) => {
        const { guildId, inviteCode } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return res.status(403).json({ error: "Bot'un 'Sunucuyu Yönet' izni yok." });
            }
            const invite = await guild.invites.fetch({ code: inviteCode, force: true }).catch(() => null);
            if (!invite) {
                return res.status(404).json({ error: 'Davet bulunamadı.' });
            }
            await invite.delete('Dashboard üzerinden silindi.');
            res.json({ success: true, message: 'Davet başarıyla silindi.' });
        } catch (e) {
            console.error(`Davet silinirken hata oluştu (Guild: ${guildId}, Code: ${inviteCode}):`, e);
            res.status(500).json({ error: 'Davet silinirken bir sunucu hatası oluştu.' });
        }
    });

    router.get('/guild/:guildId/stats', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return res.status(404).json({ message: 'Sunucu bulunamadı' });

            // PERFORMANS İYİLEŞTİRMESİ: Üyeleri tekrar çekmek yerine bot.js'de aktifleştirilen önbelleği kullan.

            const owner = await guild.fetchOwner();
            const members = guild.members.cache;
            const online = members.filter(m => m.presence?.status === 'online').size;
            const idle = members.filter(m => m.presence?.status === 'idle').size;
            const dnd = members.filter(m => m.presence?.status === 'dnd').size;

            const verificationLevels = { 0: 'Yok', 1: 'Düşük', 2: 'Orta', 3: 'Yüksek', 4: 'En Yüksek' };
            const boostTiers = { 0: 'Seviye 0', 1: 'Seviye 1', 2: 'Seviye 2', 3: 'Seviye 3' };

            const stats = {
                memberCount: guild.memberCount,
                channelCount: guild.channels.cache.size,
                roleCount: guild.roles.cache.size,
                ownerTag: owner.user.tag,
                createdAt: guild.createdTimestamp,
                verificationLevel: verificationLevels[guild.verificationLevel] || 'Bilinmiyor',
                boostTier: boostTiers[guild.premiumTier] || 'Seviye 0',
                boostCount: guild.premiumSubscriptionCount || 0,
                memberStats: {
                    humans: members.filter(m => !m.user.bot).size,
                    bots: members.filter(m => m.user.bot).size,
                    online,
                    idle,
                    dnd,
                    offline: guild.memberCount - online - idle - dnd
                },
                channelStats: {
                    text: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size,
                    voice: guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size,
                    category: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size,
                    announcement: guild.channels.cache.filter(c => c.type === ChannelType.GuildAnnouncement).size,
                    stage: guild.channels.cache.filter(c => c.type === ChannelType.GuildStageVoice).size,
                    forum: guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size,
                }
            };
            res.json(stats);
        } catch (error) {
            console.error(`Sunucu istatistikleri alınırken hata oluştu (Guild ID: ${guildId}):`, error);
            res.status(500).json({ message: 'Sunucu istatistikleri alınamadı.' });
        }
    });

    router.get('/guild/:guildId/audit-logs', checkAuth, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(req.params.guildId);
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(req.params.guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
                return res.status(403).json({ error: "Bot'un 'Denetim Kaydını Görüntüle' izni yok." });
            }

            const auditLogs = await guild.fetchAuditLogs({ limit: 100 });
            const entries = auditLogs.entries.map(entry => {
                let targetDisplay = 'Bilinmiyor';
                if (entry.target) {
                    targetDisplay = entry.target.tag || entry.target.name || `ID: ${entry.target.id}`;
                } else if (entry.extra) {
                    if (entry.extra.channel) targetDisplay = `Kanal: #${entry.extra.channel.name}`;
                    if (entry.extra.count) targetDisplay += ` (${entry.extra.count} mesaj)`;
                }

                return {
                    id: entry.id,
                    action: auditLogEventNames[entry.action] || `Bilinmeyen Eylem (${entry.action})`,
                    executor: entry.executor ? {
                        tag: entry.executor.tag,
                        avatar: entry.executor.displayAvatarURL()
                    } : { tag: 'Bilinmiyor', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' },
                    target: targetDisplay,
                    reason: entry.reason || 'Sebep belirtilmemiş.',
                    timestamp: entry.createdTimestamp
                };
            });

            res.json(entries);
        } catch (e) {
            console.error(`Denetim kaydı alınırken hata (Guild: ${req.params.guildId}):`, e);
            res.status(500).json({ error: 'Denetim kaydı alınamadı.' });
        }
    });

    router.get('/guild/:guildId/summary', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Sunucu bulunamadı.' });
            }

            // Temel bilgileri topla
            const owner = await guild.fetchOwner();
            // PERFORMANS İYİLEŞTİRMESİ: Tüm üyeleri çekmek yerine cache'i kullan.

            const onlineMembers = guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;

            let recentActivity = [];

            // Denetim Kayıtlarını al (hata durumunda devam et)
            try {
                if (guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
                    const auditLogs = await guild.fetchAuditLogs({ limit: 5 });
                    const recentAuditLogs = auditLogs.entries.map(entry => {
                        let targetDisplay = 'Bilinmiyor';
                        if (entry.target) { targetDisplay = entry.target.tag || entry.target.name || `ID: ${entry.target.id}`; }
                        return {
                            type: 'audit',
                            action: auditLogEventNames[entry.action] || `Bilinmeyen Eylem (${entry.action})`,
                            executor: entry.executor ? entry.executor.tag : 'Bilinmiyor',
                            target: targetDisplay,
                            timestamp: entry.createdTimestamp
                        };
                    });
                    recentActivity.push(...recentAuditLogs);
                }
            } catch (auditError) {
                console.error(`[Summary] Denetim kaydı alınırken hata (Guild: ${guildId}):`, auditError.message);
            }

            // Moderasyon Kayıtlarını al (hata durumunda devam et)
            try {
                const modLogs = require('../modules/moderationLogger.js').getLogsForGuild(guildId).slice(0, 5);
                const recentModLogs = modLogs.map(log => ({
                    type: 'mod', action: log.type, executor: log.moderatorTag,
                    target: log.userTag, timestamp: log.timestamp
                }));
                recentActivity.push(...recentModLogs);
            } catch (modLogError) {
                console.error(`[Summary] Moderasyon kaydı alınırken hata (Guild: ${guildId}):`, modLogError.message);
            }

            // Tüm aktiviteleri birleştir ve sırala
            recentActivity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

            const summary = {
                memberCount: guild.memberCount,
                onlineMemberCount: onlineMembers,
                channelCount: guild.channels.cache.size,
                roleCount: guild.roles.cache.size,
                ownerTag: owner.user.tag,
                recentActivity
            };
            res.json(summary);
        } catch (error) {
            console.error(`Sunucu özeti alınırken hata oluştu (Guild ID: ${guildId}):`, error);
            res.status(500).json({ error: 'Sunucu özeti alınamadı.' });
        }
    });

    router.get('/guild/:guildId/mod-logs', checkAuth, (req, res) => {
        const { guildId } = req.params;
        try {
            const moderationLogger = require('../modules/moderationLogger.js');
            const logs = moderationLogger.getLogsForGuild(guildId);
            res.json(logs);
        } catch (e) {
            console.error(`Moderasyon logları alınırken hata (Guild: ${guildId}):`, e);
            res.status(500).json({ error: 'Moderasyon logları alınamadı.' });
        }
    });

    router.get('/guild/:guildId/leaderboard', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guildXp = xpData[guildId] || {};
            const leaderboard = Object.entries(guildXp)
                .map(([userId, data]) => ({
                    userId,
                    ...data,
                    xpForNextLevel: getXPForLevel(data.level + 1),
                    xpForCurrentLevel: getXPForLevel(data.level),
                }))
                .sort((a, b) => b.timestamp - a.timestamp)
                .sort((a, b) => b.xp - a.xp)
                .slice(0, 100);

            const guild = await client.guilds.fetch(guildId);
            for (const user of leaderboard) {
                const member = await guild.members.fetch(user.userId).catch(() => null);
                if (member) {
                    user.tag = member.user.tag;
                    user.avatar = member.user.displayAvatarURL();
                } else {
                    user.tag = user.tag || 'Ayrılmış Kullanıcı'; // Eski tag'i varsa kullan, yoksa belirt
                    user.avatar = 'https://cdn.discordapp.com/embed/avatars/0.png'; // Varsayılan avatar
                }
            }

            res.json(leaderboard);
        } catch (e) {
            console.error(`Lider tablosu alınırken hata (Guild: ${guildId}):`, e);
            res.status(500).json({ error: 'Lider tablosu alınamadı.' });
        }
    });

    // YENİ: Uyarıları getiren rota
    router.get('/guild/:guildId/warnings', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guildWarnings = warningsData[guildId] || {};
            // Veriyi daha kullanışlı bir formata dönüştür: { userId, tag, warnings: [...] }
            const formattedWarnings = Object.entries(guildWarnings).map(([userId, warnings]) => {
                const userTag = warnings[0]?.moderatorTag.endsWith(userId.slice(-4)) ? warnings[0].moderatorTag : warnings[0]?.reason; // Heuristics to find a tag
                return {
                    userId,
                    userTag: warnings[0]?.userTag || userTag || 'Bilinmeyen Kullanıcı',
                    warnings
                };
            });
            res.json(formattedWarnings);
        } catch (e) { res.status(500).json({ error: 'Uyarılar alınamadı.' }); }
    });

    // YENİ: Belirli bir uyarıyı silen rota
    router.delete('/guild/:guildId/warnings/:userId/:warnId', checkAuth, async (req, res) => {
        const { guildId, userId, warnId } = req.params;

        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const userWarnings = warningsData[guildId]?.[userId];
            if (!userWarnings) {
                return res.status(404).json({ error: 'Kullanıcı için uyarı verisi bulunamadı.' });
            }

            const initialLength = userWarnings.length;
            warningsData[guildId][userId] = userWarnings.filter(w => w.id !== warnId);

            if (warningsData[guildId][userId].length === initialLength) {
                return res.status(404).json({ error: 'Belirtilen ID ile uyarı bulunamadı.' });
            }

            await saveWarningsToFile();
            res.json({ success: true, message: 'Uyarı başarıyla silindi.' });
        } catch (error) {
            res.status(500).json({ error: 'Uyarı silinirken bir sunucu hatası oluştu.' });
        }
    });

    // YENİ: Yasaklıları getiren rota
    router.get('/guild/:guildId/bans', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return res.status(403).json({ error: "Bot'un 'Üyeleri Yasakla' izni yok." });
            }
            const bans = await guild.bans.fetch();
            const formattedBans = bans.map(ban => ({
                userId: ban.user.id,
                userTag: ban.user.tag,
                avatar: ban.user.displayAvatarURL(),
                reason: ban.reason || 'Sebep belirtilmemiş.'
            }));
            res.json(formattedBans);
        } catch (e) {
            console.error(`Yasaklılar alınırken hata (Guild: ${guildId}):`, e);
            res.status(500).json({ error: 'Yasaklı kullanıcılar alınamadı.' });
        }
    });

    // YENİ: Yasak kaldırma rotası
    router.delete('/guild/:guildId/bans/:userId', checkAuth, async (req, res) => {
        const { guildId, userId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            await guild.bans.remove(userId, `Panel üzerinden ${req.user.username} tarafından kaldırıldı.`);
            client.emit('moderationLog', guild, 'UNBAN', { id: userId, tag: 'Bilinmiyor' }, req.user, 'Panel üzerinden yasak kaldırıldı.');
            res.json({ success: true, message: 'Yasak başarıyla kaldırıldı.' });
        } catch (error) {
            console.error(`Yasak kaldırılırken hata (Guild: ${guildId}, User: ${userId}):`, error);
            res.status(500).json({ error: 'Yasak kaldırılamadı. Kullanıcının yasağı zaten kaldırılmış olabilir.' });
        }
    });

    // Yedekleri listeleyen rota
    router.get('/guild/:guildId/backups', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            if (!fsSync.existsSync(backupsPath)) {
                return res.json([]); // Yedek klasörü yoksa boş dizi döndür
            }
            const files = await fs.readdir(backupsPath);
            const guildBackups = files
                .filter(file => file.startsWith(`backup-${guildId}-`) && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(backupsPath, file);
                    const stats = fsSync.statSync(filePath);
                    return {
                        id: file.replace('.json', ''), // Dosya adını ID olarak kullan
                        date: stats.mtime.getTime(), // Değiştirilme tarihini al
                        size: stats.size // YENİ: Dosya boyutunu byte olarak ekle
                    };
                })
                .sort((a, b) => b.date - a.date); // En yeniden eskiye sırala

            res.json(guildBackups);
        } catch (e) {
            console.error(`Yedekler listelenirken hata (Guild: ${guildId}):`, e);
            res.status(500).json({ error: 'Yedekler listelenemedi.' });
        }
    });

    // Yedek indirme rotası (Bu rota public/js/pages/backups.js'de kullanılıyor)
    router.get('/guild/:guildId/backups/:backupId/download', checkAuth, (req, res) => {
        const { backupId } = req.params;
        const filePath = path.join(backupsPath, `${backupId}.json`);

        if (!fsSync.existsSync(filePath)) {
            return res.status(404).send('Yedek bulunamadı.');
        }

        res.download(filePath, `${backupId}.json`, (err) => {
            if (err) {
                console.error(`Yedek indirilirken hata (Backup ID: ${backupId}):`, err);
                res.status(500).send('Yedek indirilirken bir hata oluştu.');
            }
        });
    });

    // Yeni yedek oluşturan rota
    router.post('/guild/:guildId/backup', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return res.status(403).json({ error: "Botun bu işlemi yapabilmesi için 'Yönetici' iznine ihtiyacı var." });
            }

            const backupData = {
                name: guild.name,
                icon: guild.iconURL(),
                roles: [],
                channels: [],
                settings: serverSettings[guildId] || {}
            };

            // Rolleri yedekle
            guild.roles.cache.sort((a, b) => b.position - a.position).forEach(role => {
                backupData.roles.push({
                    id: role.id, name: role.name, color: role.hexColor, hoist: role.hoist,
                    permissions: role.permissions.bitfield.toString(), mentionable: role.mentionable,
                    position: role.position
                });
            });

            // Kanalları ve kategorileri yedekle
            const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
            for (const category of categories.values()) {
                const categoryData = { id: category.id, name: category.name, type: category.type, children: [] };
                const children = category.children.cache.sort((a, b) => a.position - b.position);
                for (const child of children.values()) {
                    categoryData.children.push({
                        id: child.id, name: child.name, type: child.type, topic: child.topic
                    });
                }
                backupData.channels.push(categoryData);
            }

            const backupId = `backup-${guildId}-${Date.now()}`;
            const filePath = path.join(backupsPath, `${backupId}.json`);
            await fs.writeFile(filePath, JSON.stringify(backupData, null, 4));

            res.json({ success: true, backupId: backupId });
        } catch (error) {
            console.error(`Yedek oluşturulurken hata (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Yedek oluşturulurken bir sunucu hatası oluştu.' });
        }
    });

    // Yedek silme rotası
    router.delete('/guild/:guildId/backups/:backupId', checkAuth, async (req, res) => {
        const { guildId, backupId } = req.params;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return res.status(403).json({ error: "Botun bu işlemi yapabilmesi için 'Yönetici' iznine ihtiyacı var." });
            }

            const filePath = path.join(backupsPath, `${backupId}.json`);
            if (!fsSync.existsSync(filePath)) {
                return res.status(404).json({ error: 'Yedek bulunamadı.' });
            }

            await fs.unlink(filePath);
            res.json({ success: true, message: 'Yedek başarıyla silindi.' });
        } catch (error) {
            console.error(`Yedek silinirken hata (Guild: ${guildId}, Backup: ${backupId}):`, error);
            res.status(500).json({ error: 'Yedek silinirken bir sunucu hatası oluştu.' });
        }
    });

    // Yedekten geri yükleme rotası
    router.post('/guild/:guildId/restore', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const backupData = req.body;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }

        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return res.status(403).json({ error: "Botun bu işlemi yapabilmesi için 'Yönetici' iznine ihtiyacı var." });
            }

            // Mevcut kanalları ve rolleri sil
            for (const channel of guild.channels.cache.values()) {
                await channel.delete('Yedekten geri yükleme.').catch(e => console.error(`Kanal silinemedi: ${channel.name}`, e.message));
            }
            for (const role of guild.roles.cache.values()) {
                if (role.editable && role.name !== '@everyone') {
                    await role.delete('Yedekten geri yükleme.').catch(e => console.error(`Rol silinemedi: ${role.name}`, e.message));
                }
            }

            // Yedekten rolleri oluştur
            for (const roleData of backupData.roles.sort((a, b) => a.position - b.position)) {
                if (roleData.name === '@everyone') {
                    await guild.roles.everyone.setPermissions(BigInt(roleData.permissions));
                    continue;
                }
                await guild.roles.create({ name: roleData.name, color: roleData.color, permissions: BigInt(roleData.permissions), hoist: roleData.hoist, mentionable: roleData.mentionable, position: roleData.position });
            }

            // Yedekten kanalları oluştur
            for (const categoryData of backupData.channels.filter(c => c.type === ChannelType.GuildCategory)) {
                const newCategory = await guild.channels.create({ name: categoryData.name, type: ChannelType.GuildCategory });
                for (const channelData of categoryData.children) {
                    await guild.channels.create({ name: channelData.name, type: channelData.type, topic: channelData.topic, parent: newCategory.id });
                }
            }

            res.json({ success: true, message: 'Sunucu başarıyla geri yüklendi.' });
        } catch (error) {
            console.error(`Yedekten geri yükleme hatası (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Geri yükleme sırasında bir hata oluştu.' });
        }
    });

    // =================================================================
    // ÖZEL KOMUTLAR (CUSTOM COMMANDS)
    // =================================================================

    // Sunucudaki tüm özel komutları getir
    router.get('/guild/:guildId/custom-commands', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return res.status(404).json({ error: 'Sunucu bulunamadı.' });

            const customCommandsSettings = serverSettings[guildId]?.customCommands;
            const commands = customCommandsSettings?.commands || [];
            res.json(commands);
        } catch (error) {
            console.error(`API /custom-commands error (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Özel komutlar alınırken bir hata oluştu.' });
        }
    });

    // Yeni özel komut oluştur
    router.post('/guild/:guildId/custom-commands', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        const { id, trigger, response, type, enabled, allowedRoles, allowedChannels } = req.body;

        if (!id || !trigger || !response || !type) {
            return res.status(400).json({ error: 'Tetikleyici, yanıt ve tür gereklidir.' });
        }

        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return res.status(404).json({ error: 'Sunucu bulunamadı.' });

            if (!serverSettings[guildId]) serverSettings[guildId] = {};
            if (!serverSettings[guildId].customCommands) serverSettings[guildId].customCommands = client.modules.get('customCommands').getSettings();

            const commands = serverSettings[guildId].customCommands.commands;
            const newCommand = { id, trigger, response, type, enabled: enabled ?? true, allowedRoles: allowedRoles || [], allowedChannels: allowedChannels || [] };
            commands.push(newCommand);
            await saveSettingsToFile();

            res.json({ success: true, message: 'Komut başarıyla eklendi.', command: newCommand });
        } catch (error) {
            console.error(`API /custom-commands POST error (Guild: ${guildId}):`, error);
            res.status(500).json({ error: 'Özel komut eklenirken bir hata oluştu.' });
        }
    });

    // Özel komutu güncelle
    router.patch('/guild/:guildId/custom-commands/:commandId', checkAuth, async (req, res) => {
        const { guildId, commandId } = req.params;
        const { trigger, response, type, enabled, allowedRoles, allowedChannels } = req.body;

        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        try {
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return res.status(404).json({ error: 'Sunucu bulunamadı.' });

            const commands = serverSettings[guildId]?.customCommands?.commands;
            if (!commands) return res.status(404).json({ error: 'Özel komutlar bulunamadı.' });

            const commandIndex = commands.findIndex(cmd => cmd.id === commandId);
            if (commandIndex === -1) return res.status(404).json({ error: 'Komut bulunamadı.' });

            if (trigger !== undefined) commands[commandIndex].trigger = trigger;
            if (response !== undefined) commands[commandIndex].response = response;
            if (type !== undefined) commands[commandIndex].type = type;
            if (enabled !== undefined) commands[commandIndex].enabled = enabled;
            if (allowedRoles !== undefined) commands[commandIndex].allowedRoles = allowedRoles; // YENİ
            if (allowedChannels !== undefined) commands[commandIndex].allowedChannels = allowedChannels; // YENİ

            await saveSettingsToFile();
            res.json({ success: true, message: 'Komut başarıyla güncellendi.', command: commands[commandIndex] });
        } catch (error) {
            console.error(`API /custom-commands PATCH error (Guild: ${guildId}, Command: ${commandId}):`, error);
            res.status(500).json({ error: 'Özel komut güncellenirken bir hata oluştu.' });
        }
    });

    // Özel komutu sil
    router.delete('/guild/:guildId/custom-commands/:commandId', checkAuth, async (req, res) => {
        const { guildId, commandId } = req.params;
        try {
            // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
            try {
                await client.guilds.fetch(guildId);
            } catch (e) {
                if (e.code === 10004) { // Unknown Guild
                    return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
                }
                throw e;
            }
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return res.status(404).json({ error: 'Sunucu bulunamadı.' });

            const commands = serverSettings[guildId]?.customCommands?.commands;
            if (!commands) return res.status(404).json({ error: 'Özel komutlar bulunamadı.' });

            const initialLength = commands.length;
            serverSettings[guildId].customCommands.commands = commands.filter(cmd => cmd.id !== commandId);

            if (serverSettings[guildId].customCommands.commands.length === initialLength) {
                return res.status(404).json({ error: 'Silinecek komut bulunamadı.' });
            }

            await saveSettingsToFile();
            res.json({ success: true, message: 'Komut başarıyla silindi.' });
        } catch (error) {
            console.error(`API /custom-commands DELETE error (Guild: ${guildId}, Command: ${commandId}):`, error);
            res.status(500).json({ error: 'Özel komut silinirken bir hata oluştu.' });
        }
    });

    // =================================================================
    // BOT SAHİBİ ÖZEL (OWNER-ONLY)
    // =================================================================

    // YENİ: Panele giriş yapmış yetkili kullanıcıları listeleyen rota
    router.get('/authorized-users', checkAuth, (req, res) => {
        // SADECE BOT SAHİBİ KONTROLÜ: Bu bilginin sadece bot sahibi tarafından görülebildiğinden emin ol.
        // Güvenilir kullanıcılar listesi buradan kaldırıldı.
        if (req.user.id !== client.ownerId) {
            return res.status(403).json({ error: 'Bu bilgiye erişim yetkiniz yok.' });
        }
        res.json(authorizedUsers);
    });

    // YENİ: Panel işlem loglarını listeleyen rota
    router.get('/panel-logs', checkAuth, async (req, res) => {
        // Sadece bot sahibi erişebilir
        if (req.user.id !== client.ownerId) {
            return res.status(403).json({ error: 'Bu bilgiye erişim yetkiniz yok.' });
        }

        // Loglardaki sunucu ID'lerini isimlerle eşleştir
        const logsWithGuildNames = await Promise.all(panelLogs.map(async (log) => {
            const guild = await client.guilds.fetch(log.guildId).catch(() => null);
            return { ...log, guildName: guild ? guild.name : 'Bilinmeyen Sunucu' };
        }));

        res.json(logsWithGuildNames);
    });

    // =================================================================
    // MÜZİK SİSTEMİ API (YENİ)
    // =================================================================

    // Sıra bilgilerini getiren rota
    router.get('/guild/:guildId/music/queue', checkAuth, (req, res) => {
        const queue = player.nodes.get(req.params.guildId);
        if (!queue) {
            return res.json({ isPlaying: false });
        }

        const currentTrack = queue.currentTrack;
        if (!currentTrack) {
            return res.json({ isPlaying: false });
        }

        res.json({
            isPlaying: queue.isPlaying(),
            isPaused: queue.node.isPaused(), // GÜNCELLENDİ: Doğru durumu al
            volume: queue.node.volume,
            currentTrack: {
                title: currentTrack.title,
                author: currentTrack.author,
                url: currentTrack.url,
                thumbnail: currentTrack.thumbnail,
                duration: currentTrack.duration,
                requestedBy: currentTrack.requestedBy.tag,
                progress: queue.node.getTimestamp()
            },
            tracks: queue.tracks.toArray().slice(0, 10).map(track => ({
                title: track.title,
                author: track.author,
                duration: track.duration,
                requestedBy: track.requestedBy.tag,
            }))
        });
    });

    // Müzik kontrol rotası
    router.post('/guild/:guildId/music/control', checkAuth, (req, res) => {
        const { action } = req.body;
        const queue = player.nodes.get(req.params.guildId);
        if (!queue) return res.status(404).json({ error: 'Sırada şarkı yok.' });

        try {
            switch (action) {
                case 'togglePause':
                    queue.node.setPaused(!queue.node.isPaused());
                    break;
                case 'skip':
                    queue.node.skip();
                    break;
                case 'stop':
                    queue.delete();
                    break;
            }
            res.json({ success: true, message: `Eylem '${action}' gerçekleştirildi.` });
        } catch (e) { res.status(500).json({ error: 'Eylem gerçekleştirilirken bir hata oluştu.' }); }
    });

    // Şarkı arama rotası
    router.post('/guild/:guildId/music/search', checkAuth, async (req, res) => {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Arama sorgusu boş olamaz.' });

        try {
            const results = await player.search(query);
            if (!results || results.tracks.length === 0) {
                return res.status(404).json({ error: 'Sonuç bulunamadı.' });
            }

            // Sadece ilk 5 sonucu gönderelim
            const tracks = results.tracks.slice(0, 5).map(track => ({
                title: track.title,
                author: track.author,
                duration: track.duration,
                thumbnail: track.thumbnail,
                url: track.url,
            }));

            res.json(tracks);
        } catch (e) {
            console.error(`Müzik arama hatası:`, e);
            res.status(500).json({ error: 'Arama sırasında bir hata oluştu.' });
        }
    });

    // Şarkıyı sıraya ekleme rotası
    router.post('/guild/:guildId/music/play', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        // DÜZELTME: Botun sunucuda olup olmadığını kontrol et
        try {
            await client.guilds.fetch(guildId);
        } catch (e) {
            if (e.code === 10004) { // Unknown Guild
                return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda değil.' });
            }
            throw e;
        }
        const { trackUrl } = req.body;
        if (!trackUrl) return res.status(400).json({ error: 'Şarkı URL\'si gerekli.' });

        try {
            const guild = await client.guilds.fetch(guildId);
            const queue = player.nodes.get(guild);

            if (!queue || !queue.channel) {
                return res.status(400).json({ error: 'Bot şu anda bir ses kanalında değil. Önce bir şarkı başlatmalısınız.' });
            }

            const { track } = await player.play(queue.channel, trackUrl, {
                requestedBy: req.user.id,
                nodeOptions: { metadata: { channel: queue.metadata.channel } }
            });

            res.json({ success: true, message: `Sıraya eklendi: ${track.title}` });
        } catch (e) {
            console.error(`Şarkı ekleme hatası:`, e);
            res.status(500).json({ error: 'Şarkı sıraya eklenirken bir hata oluştu.' });
        }
    });

    // FiveM sunucu durumunu getiren rota
    router.get('/guild/:guildId/fivem/status', checkAuth, isOwner, async (req, res) => {
        const fivemSettings = serverSettings[req.params.guildId]?.fivem;
        if (!fivemSettings || !fivemSettings.enabled) {
            return res.status(400).json({ error: 'FiveM modülü aktif değil.' });
        }

        const baseUrl = `http://${fivemSettings.serverIp}:${fivemSettings.serverPort}`;
        const endpoints = ['/players.json', '/dynamic.json', '/info.json']; // DÜZELTME: /info.json eklendi
        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(baseUrl + endpoint, { signal: AbortSignal.timeout(2500) }); // Timeout süresini kısalttık
                if (!response.ok) {
                    throw new Error(`Sunucu ${response.status} koduyla yanıt verdi.`);
                }
                const data = await response.json();

                // Gelen veriye göre online durumunu ve oyuncu sayısını belirle
                const result = {
                    online: true,
                    // DÜZELTME: /info.json'dan gelen 'vars' nesnesini ve diğer formatları kontrol et
                    players: data.players || (data.vars ? [] : data), // info.json'da oyuncu listesi yok, boş dizi döndür
                    // DÜZELTME: /info.json'dan gelen 'sv_maxclients' verisini de al
                    maxplayers: data.sv_maxclients || data.maxplayers || data.vars?.sv_maxclients || 'N/A'
                };
                return res.json(result);
            } catch (e) {
                lastError = e;
                continue; // Bir sonraki endpoint'i dene
            }
        }

        // Eğer döngüdeki tüm denemeler başarısız olduysa
        res.status(500).json({ error: `Sunucuya ulaşılamadı: ${lastError.message}. IP ve Port ayarlarını kontrol edin.` });
    });

    // YENİ: Bot banner'ını ayarlayan rota (Sadece bot sahibi)
    router.post('/bot/banner', checkAuth, isOwner, upload.single('banner'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'Banner dosyası yüklenmedi.' });
        }

        try {
            // DÜZELTME: Banner dosya adını ayarlara kaydet
            if (!serverSettings.global) serverSettings.global = {};
            if (!serverSettings.global.botBanner) serverSettings.global.botBanner = {};

            const oldBanner = serverSettings.global.botBanner.fileName;
            if (oldBanner) {
                const oldPath = path.join(__dirname, '..', 'uploads', oldBanner);
                if (fsSync.existsSync(oldPath)) await fs.unlink(oldPath);
            }

            serverSettings.global.botBanner.fileName = req.file.filename;
            await saveSettingsToFile();

            // bot.js'deki global olayı tetikle
            // DÜZELTME: İşlemin sonucunu beklemek için Promise kullan
            await new Promise((resolve, reject) => {
                client.emit('setBotBanner', req.file.path, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            res.json({ success: true, message: 'Bot banner\'ı başarıyla güncellendi.' });

        } catch (error) {
            console.error('Bot banner ayarlanırken hata:', error);
            // Yüklenen dosyayı hata durumunda sil
            await fs.unlink(req.file.path).catch(err => console.error("Hatalı banner dosyası silinemedi:", err));
            // DÜZELTME: Discord'dan gelen hatayı doğrudan kullanıcıya gönder
            res.status(400).json({ error: error.message || 'Banner ayarlanırken bir sunucu hatası oluştu.' });
        }
    });

    return router;
};

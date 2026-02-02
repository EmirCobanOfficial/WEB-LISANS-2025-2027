const { EmbedBuilder } = require('discord.js');

// Bu map, kullanıcıların mesaj zaman damgalarını saklayacaktır.
// Anahtar: `${sunucu.id}-${kullanıcı.id}`, Değer: [zamanDamgası1, zamanDamgası2, ...]
const userMessages = new Map();

// YENİ: Bellek temizliği (Garbage Collection)
// Her 10 dakikada bir çalışır ve 5 dakikadan eski verileri temizler.
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of userMessages.entries()) {
        if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 300000) { // 5 dakika
            userMessages.delete(key);
        }
    }
}, 600000); // 10 dakika

module.exports = {
    name: 'antiRaid',
    getSettings: () => ({
        enabled: false,
        messageLimit: 5,      // Örn: 5 mesaj
        timeInterval: 3000,   // Örn: 3 saniye içinde (3000ms)
        action: 'timeout',    // 'timeout', 'kick', 'ban'
    }),
    // DÜZELTME: init yerine onMessage kullanılarak bot.js mimarisine uyumlu hale getirildi.
    onMessage: async (client, message, serverSettings) => {
        if (message.author.bot || !message.guild) return;

        const settings = serverSettings[message.guild.id]?.antiRaid;
        const modSettings = serverSettings[message.guild.id]?.moderation;

        if (!settings || !settings.enabled) return;

        const key = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const time = settings.timeInterval || 3000;
        const limit = settings.messageLimit || 5;

        // 1. Önceki zaman damgalarını al ve süresi geçenleri temizle.
        const previousTimestamps = userMessages.get(key) || [];
        const recentTimestamps = previousTimestamps.filter(ts => now - ts < time);

        // 2. Yeni mesajın zaman damgasını ekle.
        recentTimestamps.push(now);

        // 3. Güncellenmiş listeyi tekrar map'e kaydet.
        userMessages.set(key, recentTimestamps);

        // 4. Kullanıcının mesaj limitini aşıp aşmadığını kontrol et.
        if (recentTimestamps.length > limit) {
            const member = message.member;

            // Üyenin cezalandırılabilir olup olmadığını kontrol et.
            if (!member || !member.moderatable) {
                // Başarısızlık nedenini log kanalına bildir.
                if (modSettings && modSettings.enabled && modSettings.logChannelId) {
                    const logChannel = await client.channels.fetch(modSettings.logChannelId).catch(() => null);
                    if (logChannel) {
                        let reason = "Bilinmeyen bir nedenle cezalandırılamadı.";
                        if (!member) {
                            reason = "Üye detayları alınamadı.";
                        } else if (member.user.id === message.guild.ownerId) {
                            reason = "Sunucu sahibi cezalandırılamaz.";
                        } else if (!member.manageable) {
                            reason = "Botun rolü bu üyeyi yönetmek için yeterince yüksek değil.";
                        } else {
                            reason = "Botun 'Üyeleri Zaman Aşımına Uğrat' izni eksik.";
                        }

                        const embed = new EmbedBuilder()
                            .setColor(0xFFA500) // Turuncu (Uyarı)
                            .setTitle('🚨 ANTI-RAID EYLEMİ BAŞARISIZ 🚨')
                            .setDescription(`Kullanıcı **${message.author.tag}** spam filtresini tetikledi ancak cezalandırılamadı.`)
                            .addFields({ name: 'Sebep', value: reason, inline: false })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] });
                    }
                }
                // Log kanalını spamlememek için kullanıcının mesaj geçmişini temizle
                userMessages.delete(key);
                return;
            }

            let punishmentLog = `Uygulanan Eylem: **${settings.action.toUpperCase()}**`;
            const reason = `Anti-Raid: Mesaj limiti aşıldı (${limit} mesaj / ${time / 1000}s).`;

            try {
                switch (settings.action) {
                    case 'kick':
                        await member.kick(reason);
                        break;
                    case 'ban':
                        await member.ban({ reason });
                        break;
                    case 'timeout':
                    default:
                        await member.timeout(10 * 60 * 1000, reason);
                        break;
                }
                // Moderasyon eylemini doğrudan logger modülüne kaydet
                const moderationLogger = require('./moderationLogger.js');
                moderationLogger.addLog(message.guild.id, settings.action.toUpperCase(), member.user, client.user, reason);

            } catch (error) {
                console.error(`Anti-raid eylemi gerçekleştirilemedi (${member.user.tag}):`, error);
                punishmentLog = `⚠️ **Eylem Başarısız:** ${member.user.tag} cezalandırılırken bir hata oluştu.`;
            }

            // Tekrar tetiklenmesini önlemek için kullanıcının mesaj geçmişini temizle
            userMessages.delete(key);

            // Moderasyon kanalı varsa eylemi logla
            if (modSettings && modSettings.enabled && modSettings.logChannelId) {
                const logChannel = await client.channels.fetch(modSettings.logChannelId).catch(() => null);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000) // Kırmızı
                        .setTitle('🚨 ANTI-RAID UYARISI 🚨')
                        .setDescription(`Kullanıcı **${message.author.tag}** spam/raid için işaretlendi.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: 'Detaylar', value: `${time / 1000} saniyede ${limit}'den fazla mesaj gönderdi.`, inline: false },
                            { name: 'Botun Müdahalesi', value: punishmentLog, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            }
        }
    }
};
